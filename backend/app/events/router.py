import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.deps import DB, Me
from app.errors import ok
from app.events import service
from app.sessions.service import check_access, get_session

router = APIRouter(prefix="/api/events", tags=["events"])


def _student_view(user: Any, owner_id: uuid.UUID) -> bool:
    return bool(not user.has("teacher", "admin") and owner_id == user.id)


@router.get("")
async def events(
    user: Me,
    db: DB,
    session_id: uuid.UUID,
    type: list[str] | None = Query(None),
    severity: str | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
) -> dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s)
    types = type
    if _student_view(user, s.user_id):
        allowed = set(service.STUDENT_VISIBLE)
        types = [t for t in (type or list(allowed)) if t in allowed]
        if not types:  # an unknown type must not turn into "no filter"
            return ok([])
    rows = await service.list_events(
        db, session_id, types=types, severity=severity, date_from=date_from, date_to=date_to
    )
    return ok([service.event_out(e) for e in rows])


@router.get("/export", response_model=None)
async def export(
    user: Me, db: DB, session_id: uuid.UUID, format: Literal["json", "csv"] = "json"
) -> Response | dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s)
    types = list(service.STUDENT_VISIBLE) if _student_view(user, s.user_id) else None
    rows = await service.list_events(db, session_id, types=types, limit=100_000)
    if format == "csv":
        return Response(
            service.to_csv(rows),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="trace-{session_id}.csv"'},
        )
    return ok([service.event_out(e) for e in rows])
