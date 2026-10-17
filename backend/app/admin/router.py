"""Administration and operations: sandbox profiles, audit, security events, system state (ТП рис. 41–43)."""

import csv
import io
import shutil
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, literal_column, select, text

from app import health as worker_health
from app.audit.models import AuditLog, SecurityEvent
from app.audit.service import record_audit
from app.deps import DB, AdminUser, OpsUser
from app.errors import AppError, ErrorCode, ok
from app.llm_gateway.models import LLMProvider, LLMSettings
from app.reports.service import require_period
from app.sandbox.manager import LABEL_KIND, LABEL_SESSION, LABEL_USER, get_sandbox
from app.sandbox.models import SandboxProfile
from app.sessions.models import LearningSession
from app.users.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ProfilePatch(BaseModel):
    cpu: float | None = Field(default=None, gt=0, le=16)
    mem_mb: int | None = Field(default=None, ge=256, le=65536)
    pids_limit: int | None = Field(default=None, ge=32, le=4096)
    storage_mb: int | None = Field(default=None, ge=64, le=102400)


def _profile(p: SandboxProfile, active: int = 0) -> dict[str, Any]:
    return {
        "code": p.code,
        "image": p.image,
        "cpu": float(p.cpu),
        "mem_mb": p.mem_mb,
        "pids_limit": p.pids_limit,
        "storage_mb": p.storage_mb,
        "network_policy": p.network_policy,
        "active": active,
    }


@router.get("/sandbox/profiles")
async def profiles(user: OpsUser, db: DB) -> dict[str, Any]:
    from app.scenarios.models import ScenarioRun

    rows = (await db.scalars(select(SandboxProfile).order_by(SandboxProfile.code))).all()
    counts: dict[str, int] = {}
    prof = ScenarioRun.generated_spec.op("->>")(literal_column("'profile'")).label("prof")
    active = (
        await db.execute(
            select(prof, func.count())
            .join(LearningSession, LearningSession.run_id == ScenarioRun.id)
            .where(LearningSession.status.in_(("active", "paused")))
            .group_by(prof)
        )
    ).all()
    for code, n in active:
        counts[str(code)] = int(n)
    return ok([_profile(p, counts.get(p.code, 0)) for p in rows])


@router.patch("/sandbox/profiles/{code}")
async def patch_profile(code: str, body: ProfilePatch, admin: AdminUser, db: DB) -> dict[str, Any]:
    p = await db.get(SandboxProfile, code)
    if p is None:
        raise AppError(ErrorCode.NOT_FOUND, "Профиль не найден.")
    before = _profile(p)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, Decimal(str(v)) if k == "cpu" else v)
    record_audit(
        db,
        actor_id=admin.id,
        action="sandbox.profile",
        object_type="sandbox_profile",
        object_id=code,
        before=before,
        after=_profile(p),
    )
    await db.commit()
    return ok(_profile(p))


def _audit_out(a: AuditLog, names: dict[uuid.UUID, str]) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "created_at": a.created_at.isoformat(),
        "actor": names.get(a.actor_id) if a.actor_id else None,
        "action": a.action,
        "object_type": a.object_type,
        "object_id": a.object_id,
        "before": a.before,
        "after": a.after,
        "reason": a.reason,
    }


def _sec_out(e: SecurityEvent, names: dict[uuid.UUID, str]) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "created_at": e.created_at.isoformat(),
        "kind": e.kind,
        "severity": e.severity,
        "user": names.get(e.user_id) if e.user_id else None,
        "session_id": str(e.session_id) if e.session_id else None,
        "details": e.details,
    }


async def _names(db: DB, ids: set[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    clean = {i for i in ids if i is not None}
    if not clean:
        return {}
    return {u.id: u.email for u in (await db.scalars(select(User).where(User.id.in_(clean)))).all()}


@router.get("/audit")
async def audit(
    user: OpsUser,
    db: DB,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    action: str | None = None,
    limit: int = Query(200, le=2000),
) -> dict[str, Any]:
    df, dt = require_period(date_from, date_to)
    stmt = select(AuditLog).where(AuditLog.created_at >= df, AuditLog.created_at <= dt)
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    rows = (await db.scalars(stmt.order_by(AuditLog.created_at.desc()).limit(limit))).all()
    names = await _names(db, {r.actor_id for r in rows})
    return ok([_audit_out(r, names) for r in rows])


@router.get("/security-events")
async def security_events(
    user: OpsUser,
    db: DB,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    limit: int = Query(200, le=2000),
) -> dict[str, Any]:
    df, dt = require_period(date_from, date_to)
    rows = (
        await db.scalars(
            select(SecurityEvent)
            .where(SecurityEvent.created_at >= df, SecurityEvent.created_at <= dt)
            .order_by(SecurityEvent.created_at.desc())
            .limit(limit)
        )
    ).all()
    names = await _names(db, {r.user_id for r in rows})
    return ok([_sec_out(r, names) for r in rows])


@router.get("/logs/export", response_model=None)
async def export_logs(
    user: OpsUser,
    db: DB,
    log: Literal["audit", "security"] = "security",
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
) -> Response:
    df, dt = require_period(date_from, date_to)
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    if log == "audit":
        rows_a = (
            await db.scalars(
                select(AuditLog)
                .where(AuditLog.created_at >= df, AuditLog.created_at <= dt)
                .order_by(AuditLog.created_at)
            )
        ).all()
        names = await _names(db, {r.actor_id for r in rows_a})
        w.writerow(["Время", "Пользователь", "Действие", "Объект", "Идентификатор", "Причина"])
        for a in rows_a:
            w.writerow(
                [
                    a.created_at.isoformat(),
                    names.get(a.actor_id, "") if a.actor_id else "",
                    a.action,
                    a.object_type,
                    a.object_id,
                    a.reason or "",
                ]
            )
    else:
        rows_s = (
            await db.scalars(
                select(SecurityEvent)
                .where(SecurityEvent.created_at >= df, SecurityEvent.created_at <= dt)
                .order_by(SecurityEvent.created_at)
            )
        ).all()
        names = await _names(db, {r.user_id for r in rows_s})
        w.writerow(["Время", "Тип", "Severity", "Пользователь", "Сессия", "Детали"])
        for e in rows_s:
            w.writerow(
                [
                    e.created_at.isoformat(),
                    e.kind,
                    e.severity,
                    names.get(e.user_id, "") if e.user_id else "",
                    str(e.session_id or ""),
                    str(e.details),
                ]
            )
    return Response(
        "﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{log}-{df.date()}-{dt.date()}.csv"'},
    )


@router.get("/health")
async def system_health(user: OpsUser, db: DB) -> dict[str, Any]:
    now = datetime.now(UTC)
    comp: dict[str, Any] = {}
    try:
        size = await db.scalar(text("SELECT pg_database_size(current_database())"))
        comp["postgresql"] = {"ok": True, "size_bytes": int(size or 0)}
    except Exception as exc:
        comp["postgresql"] = {"ok": False, "error": str(exc)[:200]}
    w = worker_health.worker_state()
    comp["worker"] = {"ok": w["age_sec"] is not None and w["age_sec"] < 60, **w}
    sandboxes: list[dict[str, Any]] = []
    try:
        info = await get_sandbox().ping()
        comp["docker"] = {"ok": True, **info}
        items = await get_sandbox().list_by_label(LABEL_SESSION)
        sids = []
        for c in items:
            try:
                sids.append(uuid.UUID(c["labels"].get(LABEL_SESSION, "")))
            except ValueError:
                pass
        sess = {s.id: s for s in (await db.scalars(select(LearningSession).where(LearningSession.id.in_(sids)))).all()}
        emails = await _names(db, {s.user_id for s in sess.values()})
        for c in items:
            lab = c["labels"]
            sid = lab.get(LABEL_SESSION, "")
            s = sess.get(uuid.UUID(sid)) if sid and len(sid) == 36 else None
            sandboxes.append(
                {
                    "container_id": c["id"][:12],
                    "id": c["id"],
                    "kind": lab.get(LABEL_KIND, "session"),
                    "session_id": sid,
                    "user": emails.get(s.user_id) if s else lab.get(LABEL_USER),
                    "session_status": s.status if s else None,
                    "state": c["state"],
                    "status": c["status"],
                    "uptime_sec": int(now.timestamp() - int(c.get("created") or now.timestamp())),
                    "orphan": s is None or s.status not in ("starting", "active", "paused", "checking"),
                }
            )
    except Exception as exc:
        comp["docker"] = {"ok": False, "error": str(exc)[:200]}
    mode = await db.get(LLMSettings, 1)
    providers = (await db.scalars(select(LLMProvider).order_by(LLMProvider.priority))).all()
    comp["llm"] = {
        "ok": True,
        "generation_mode": mode.generation_mode if mode else None,
        "providers": [{"code": p.code, "status": p.status, "last_error": p.last_error} for p in providers],
    }
    counts = dict(
        (await db.execute(select(LearningSession.status, func.count()).group_by(LearningSession.status))).all()
    )
    disk = shutil.disk_usage("/")
    from app.config import get_settings

    return ok(
        {
            "checked_at": now.isoformat(),
            "components": comp,
            "sandboxes": sandboxes,
            "sessions": {k: int(v) for k, v in counts.items()},
            "capacity": {
                "active": int(counts.get("active", 0)) + int(counts.get("paused", 0)),
                "max": get_settings().sandbox_max_sessions,
            },
            "disk": {"total": disk.total, "used": disk.used},
        }
    )


@router.post("/sandboxes/{container_id}/cleanup")
async def cleanup(container_id: str, user: OpsUser, db: DB, force: bool = False) -> dict[str, Any]:
    items = await get_sandbox().list_by_label(LABEL_SESSION)
    target = next((c for c in items if c["id"].startswith(container_id)), None)
    if target is None:
        raise AppError(ErrorCode.NOT_FOUND, "Учебная среда не найдена.")
    sid = target["labels"].get(LABEL_SESSION, "")
    s = None
    try:
        s = await db.get(LearningSession, uuid.UUID(sid))
    except ValueError:
        pass
    if s is not None and s.status in ("active", "paused", "checking") and not force:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Среда используется активной сессией. Для удаления укажите force.")
    await get_sandbox().remove(target["id"])
    if s is not None and s.status in ("active", "paused"):
        s.status, s.finished_at, s.sandbox_container_id = "failed", datetime.now(UTC), None
        s.error = "removed by operator"
    record_audit(
        db,
        actor_id=user.id,
        action="sandbox.cleanup",
        object_type="container",
        object_id=target["id"][:12],
        after={"session_id": sid, "force": force},
    )
    await db.commit()
    return ok({"removed": target["id"][:12]})


@router.get("/background")
async def background(user: OpsUser, db: DB) -> dict[str, Any]:
    now = datetime.now(UTC)
    pending_inc = await db.scalar(
        select(func.count())
        .select_from(LearningSession)
        .where(
            LearningSession.status == "active",
            LearningSession.incident_due_at.is_not(None),
            LearningSession.incident_applied_at.is_(None),
        )
    )
    paused = await db.scalar(
        select(func.count()).select_from(LearningSession).where(LearningSession.status == "paused")
    )
    checking = await db.scalar(
        select(func.count()).select_from(LearningSession).where(LearningSession.status.in_(("submitted", "checking")))
    )
    from app.scenarios.models import ScenarioRun

    generated = await db.scalar(
        select(func.count()).select_from(ScenarioRun).where(ScenarioRun.created_at >= now - timedelta(hours=1))
    )
    return ok(
        {
            "incidents_pending": int(pending_inc or 0),
            "paused_sessions": int(paused or 0),
            "checking": int(checking or 0),
            "generated_last_hour": int(generated or 0),
            "worker": worker_health.worker_state(),
        }
    )
