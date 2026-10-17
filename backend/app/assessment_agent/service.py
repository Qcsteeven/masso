"""Submission: final command collection, AssessmentAgent run, session completion (ТЗ 4.2, 4.7)."""

import logging
import time
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment_agent.graph import AssessmentAgent
from app.errors import AppError, ErrorCode
from app.events.service import record_event
from app.sandbox.manager import get_sandbox
from app.sessions.models import LearningSession
from app.sessions.service import collect_commands

log = logging.getLogger("masso.assessment")


async def submit(db: AsyncSession, s: LearningSession, *, auto: bool = False) -> dict[str, Any]:
    if s.status not in ("active", "paused"):
        raise AppError(ErrorCode.SESSION_NOT_READY, "Сессия уже завершена или ещё не запущена.")
    t0 = time.perf_counter()
    if s.status == "paused" and s.sandbox_container_id:
        try:
            await get_sandbox().unpause(s.sandbox_container_id)
        except Exception as exc:
            log.warning("unpause before submit failed: %s", exc)
    s.status = "active"
    if s.sandbox_container_id:
        try:
            await collect_commands(db, s)
        except Exception:
            log.exception("final command collection failed")
    s.status, s.finished_at = "checking", datetime.now(UTC)
    record_event(
        db,
        s,
        "status",
        {
            "status": "checking",
            "auto": auto,
            "message": "Время вышло, результат отправлен на проверку." if auto else "Результат отправлен на проверку.",
        },
    )
    await db.commit()
    try:
        state = await AssessmentAgent(db).run(s.id)
    except Exception as exc:
        log.exception("assessment failed for %s", s.id)
        await db.rollback()
        s.status = "failed"
        s.error = f"assessment: {str(exc)[:400]}"
        record_event(
            db,
            s,
            "status",
            {"status": "failed", "message": "Проверка не выполнена. Обратитесь к преподавателю."},
            "error",
        )
        await db.commit()
        raise AppError(
            ErrorCode.VERIFICATION_FAILED, "Не удалось выполнить проверку. Обратитесь к преподавателю."
        ) from exc
    s.status = "completed"
    sc = state["score"]
    record_event(
        db,
        s,
        "status",
        {
            "status": "completed",
            "score": sc["final"],
            "passed": sc["passed"],
            "report_id": state["report_id"],
            "message": "Проверка завершена.",
        },
    )
    await db.commit()
    return {
        "report_id": state["report_id"],
        "status": "completed",
        "score": sc,
        "duration_ms": int((time.perf_counter() - t0) * 1000),
        "timings": state.get("timings", {}),
    }
