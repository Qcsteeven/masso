"""Worker jobs (spec §6): incidents, command trail, idle control, reaper, retention."""

import logging
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from app.audit.models import SecurityEvent
from app.config import get_settings
from app.db import get_sessionmaker
from app.events.models import EnvironmentEvent
from app.sandbox.manager import LABEL_KIND, LABEL_SESSION, get_sandbox
from app.sessions import service
from app.sessions.models import LearningSession
from app.worker import register

log = logging.getLogger("masso.worker")


async def incidents_job(now: datetime) -> None:
    async with get_sessionmaker()() as db:
        rows = (
            await db.scalars(
                select(LearningSession)
                .where(
                    LearningSession.status == "active",
                    LearningSession.incident_due_at <= now,
                    LearningSession.incident_applied_at.is_(None),
                )
                .limit(50)
            )
        ).all()
        for s in rows:
            try:
                await service.apply_incident(db, s, now)
                await db.commit()
            except Exception:
                await db.rollback()
                log.exception("incident failed for %s", s.id)


async def commands_job(now: datetime) -> None:
    async with get_sessionmaker()() as db:
        rows = (
            await db.scalars(
                select(LearningSession).where(
                    LearningSession.status == "active",
                    LearningSession.kind == "container",
                    LearningSession.sandbox_container_id.is_not(None),
                )
            )
        ).all()
        for s in rows:
            try:
                if await service.collect_commands(db, s):
                    await db.commit()
            except Exception:
                await db.rollback()
                log.exception("command collection failed for %s", s.id)


async def idle_job(now: datetime) -> None:
    st = get_settings()
    async with get_sessionmaker()() as db:
        idle = (
            await db.scalars(
                select(LearningSession).where(
                    LearningSession.status == "active",
                    LearningSession.last_activity_at < now - timedelta(minutes=st.sandbox_idle_pause_min),
                )
            )
        ).all()
        for s in idle:
            await service.pause(db, s, now, reason="idle")
            await db.commit()
        stale = (
            await db.scalars(
                select(LearningSession).where(
                    LearningSession.status.in_(("active", "paused")),
                    LearningSession.last_activity_at < now - timedelta(hours=st.sandbox_expire_hours),
                )
            )
        ).all()
        for s in stale:
            await service.expire(db, s, now)
            await db.commit()


async def reaper_job(now: datetime) -> None:
    """Remove containers that have no open session (and stale validation containers)."""
    sb = get_sandbox()
    try:
        items = await sb.list_by_label(LABEL_SESSION)
    except Exception:
        return
    async with get_sessionmaker()() as db:
        for c in items:
            labels = c.get("labels", {})
            kind = labels.get(LABEL_KIND, "session")
            if kind == "validation":
                created = datetime.fromtimestamp(int(c.get("created") or 0), now.tzinfo)
                if now - created > timedelta(minutes=10):
                    await sb.remove(c["id"])
                continue
            if kind != "session":
                continue
            sid = labels.get(LABEL_SESSION, "")
            try:
                import uuid

                s = await db.get(LearningSession, uuid.UUID(sid))
            except ValueError:
                s = None
            if s is None or s.status not in ("starting", "active", "paused", "submitted", "checking"):
                await sb.remove(c["id"])


_last_retention: datetime | None = None


async def retention_job(now: datetime) -> None:
    global _last_retention
    if _last_retention and now - _last_retention < timedelta(hours=1):
        return
    _last_retention = now
    st = get_settings()
    async with get_sessionmaker()() as db:
        await db.execute(
            delete(EnvironmentEvent).where(EnvironmentEvent.created_at < now - timedelta(days=st.retention_events_days))
        )
        await db.execute(
            delete(SecurityEvent).where(SecurityEvent.created_at < now - timedelta(days=st.retention_security_days))
        )
        await db.commit()


register("incidents", incidents_job)
register("commands", commands_job)
register("idle", idle_job)
register("reaper", reaper_job)
register("retention", retention_job)
