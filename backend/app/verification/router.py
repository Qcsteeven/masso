import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.audit.service import record_audit
from app.deps import DB, Me, TeacherUser
from app.errors import AppError, ErrorCode, ok
from app.events.models import EnvironmentEvent
from app.reports.models import Report
from app.scenarios.models import AcceptedSolution, ScenarioRun
from app.sessions.service import check_access, get_session
from app.verification.models import VerificationResult

router = APIRouter(prefix="/api/verification", tags=["verification"])


class CorrectionIn(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    reason: str | None = Field(default=None, max_length=1000)
    confirm: bool = False
    alternative: bool = False


def _out(v: VerificationResult) -> dict[str, Any]:
    return {
        "session_id": str(v.session_id),
        "checks": v.checks,
        "base_score": v.base_score,
        "final_score": v.final_score,
        "status": v.status,
        "errors": v.errors,
        "corrected_score": v.corrected_score,
        "correction_reason": v.correction_reason,
        "corrected_by": str(v.corrected_by) if v.corrected_by else None,
        "review_status": review_status(v),
        "created_at": v.created_at.isoformat(),
    }


def review_status(v: VerificationResult) -> str:
    if v.corrected_by is None:
        return "pending"
    return "confirmed" if v.corrected_score == v.final_score else "corrected"


async def _get(db: DB, session_id: uuid.UUID) -> VerificationResult:
    v = await db.scalar(select(VerificationResult).where(VerificationResult.session_id == session_id))
    if v is None:
        raise AppError(ErrorCode.NOT_FOUND, "Результат проверки ещё не сформирован.")
    return v


@router.get("/{session_id}")
async def get(session_id: uuid.UUID, user: Me, db: DB) -> dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s)
    return ok(_out(await _get(db, session_id)))


@router.patch("/{session_id}")
async def correct(session_id: uuid.UUID, body: CorrectionIn, user: TeacherUser, db: DB) -> dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s)
    v = await _get(db, session_id)
    reason = (body.reason or "").strip()
    if body.confirm:
        new_score = v.final_score
    else:
        if body.score is None or len(reason) < 3:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Укажите экспертную оценку и причину изменения.",
                {"fields": [{"loc": ["reason"], "msg": "обязательное поле"}]},
            )
        new_score = body.score
    before = {"final_score": v.final_score, "corrected_score": v.corrected_score}
    v.corrected_score, v.corrected_by = new_score, user.id
    v.correction_reason = reason or "Автоматическая оценка подтверждена."
    record_audit(
        db,
        actor_id=user.id,
        action="verification.confirm" if body.confirm else "verification.correct",
        object_type="session",
        object_id=str(s.id),
        before=before,
        after={"corrected_score": new_score, "alternative": body.alternative},
        reason=v.correction_reason,
    )
    report = await db.scalar(select(Report).where(Report.session_id == s.id))
    if report is not None:
        report.payload = {
            **report.payload,
            "teacher": {
                "score": new_score,
                "reason": v.correction_reason,
                "confirmed": body.confirm,
                "by": user.full_name,
                "at": datetime.now(UTC).isoformat(),
                "alternative": body.alternative,
            },
        }
    if body.alternative:
        run = await db.get(ScenarioRun, s.run_id)
        cmds = (
            await db.scalars(
                select(EnvironmentEvent.payload)
                .where(EnvironmentEvent.session_id == s.id, EnvironmentEvent.type.in_(("command", "answer")))
                .order_by(EnvironmentEvent.created_at)
            )
        ).all()
        if run is not None:
            db.add(
                AcceptedSolution(
                    template_id=run.template_id, session_id=s.id, trace={"steps": list(cmds)}, approved_by=user.id
                )
            )
    await db.commit()
    return ok(_out(v))
