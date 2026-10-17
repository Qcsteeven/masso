"""Worker jobs: auto-submit sessions whose time limit is over or whose training server exceeds its disk quota."""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.assessment_agent.service import submit
from app.audit.service import record_security
from app.db import get_sessionmaker
from app.errors import AppError
from app.sandbox.manager import get_sandbox
from app.sandbox.service import load_profile
from app.scenarios.spec import ContainerSpec
from app.sessions.models import LearningSession
from app.sessions.service import load_spec
from app.worker import register

QUOTA_EVERY = timedelta(seconds=60)
_last_quota: datetime | None = None

log = logging.getLogger("masso.worker")


async def time_limit_job(now: datetime) -> None:
    async with get_sessionmaker()() as db:
        rows = (
            await db.scalars(
                select(LearningSession).where(
                    LearningSession.status == "active", LearningSession.started_at.is_not(None)
                )
            )
        ).all()
        for s in rows:
            assert s.started_at is not None
            if now >= s.started_at + timedelta(minutes=s.time_limit_min):
                try:
                    await submit(db, s, auto=True)
                except AppError:
                    log.warning("auto-submit failed for %s", s.id)


async def quota_job(now: datetime) -> None:
    """Docker cannot cap the anonymous /srv volume on overlay2 without xfs quotas, so the worker watches its size
    (profile storage_mb, measured by the daemon in one call for all volumes) and ends a session over the limit."""
    global _last_quota
    if _last_quota is not None and now - _last_quota < QUOTA_EVERY:
        return
    _last_quota = now
    sb = get_sandbox()
    try:
        sizes = await sb.volume_sizes_mb()
    except Exception:
        log.warning("volume sizes are unavailable")
        return
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
                _run, spec = await load_spec(db, s)
                if not isinstance(spec, ContainerSpec):
                    continue
                limit = (await load_profile(db, spec.profile)).storage_mb
                assert s.sandbox_container_id is not None
                volume = await sb.srv_volume(s.sandbox_container_id)
                used = sizes.get(volume or "", 0)
            except Exception:
                log.warning("quota check failed for %s", s.id)
                continue
            if not limit or used <= limit:
                continue
            record_security(
                db,
                kind="sandbox_quota",
                user_id=s.user_id,
                session_id=s.id,
                severity="high",
                details={"used_mb": used, "limit_mb": limit},
            )
            try:
                await submit(
                    db, s, auto=True, message="Превышен объём диска учебной среды, результат отправлен на проверку."
                )
            except AppError:
                log.warning("quota auto-submit failed for %s", s.id)


register("time_limit", time_limit_job)
register("quota", quota_job)
