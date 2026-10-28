"""Student self-check during a session: which criteria pass right now (no penalty, throttled, traced; Д-42)."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError, ErrorCode
from app.events.models import EnvironmentEvent
from app.events.service import record_event
from app.sandbox.manager import get_sandbox
from app.scenarios.spec import ContainerSpec
from app.sessions.models import LearningSession
from app.sessions.service import applied_incidents, load_spec, lock_session, touch
from app.verification.engine import CheckContext, run_checks

INTERVAL_SEC = 30


async def self_check(db: AsyncSession, s: LearningSession) -> dict[str, Any]:
    await lock_session(db, s)  # one self-check at a time per session
    if s.status != "active":
        raise AppError(ErrorCode.SESSION_NOT_READY, "Проверка доступна, пока сессия активна.")
    now = datetime.now(UTC)
    events = list((await db.scalars(select(EnvironmentEvent).where(EnvironmentEvent.session_id == s.id))).all())
    last = max(
        (e.created_at for e in events if e.type == "check" and (e.payload or {}).get("self_check")), default=None
    )
    if last is not None and (wait := INTERVAL_SEC - int((now - last).total_seconds())) > 0:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, f"Следующая проверка будет доступна через {wait} с.", {"retry_after_sec": wait}
        )
    _run, spec = await load_spec(db, s)
    ctx = CheckContext(applied_incidents=applied_incidents(s, events))
    if isinstance(spec, ContainerSpec):
        if not s.sandbox_container_id:
            raise AppError(ErrorCode.SESSION_NOT_READY, "Учебная среда ещё не готова.")
        ctx.container_id, ctx.sandbox = s.sandbox_container_id, get_sandbox()
    else:
        ctx.answers = (s.documents_state or {}).get("answers", {})
    # only titles and outcomes: check parameters, outputs and weights stay on the server
    results = [{"title": r.title, "passed": r.passed, "skipped": r.skipped} for r in await run_checks(spec, ctx)]
    passed = sum(1 for r in results if r["passed"])
    payload = {"self_check": True, "results": results, "passed": passed, "total": len(results)}
    record_event(db, s, "check", payload, "info")
    await touch(db, s, now)
    await db.commit()
    return {**payload, "retry_after_sec": INTERVAL_SEC}
