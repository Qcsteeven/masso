import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.deps import DB, Me, StudentUser, TeacherUser
from app.errors import ok
from app.reports import service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
async def overview(
    user: TeacherUser,
    db: DB,
    group: str | None = None,
    domain: str | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
) -> dict[str, Any]:
    return ok(await service.group_overview(db, user, group, date_from, date_to, domain))


@router.get("/export", response_model=None)
async def export(
    user: TeacherUser,
    db: DB,
    group: str | None = None,
    format: Literal["csv", "json"] = "csv",
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
) -> Response:
    body, media = await service.export(db, user, group, date_from, date_to, format)
    name = f"masso-report-{(date_from or datetime.now()).date()}-{(date_to or datetime.now()).date()}.{format}"
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/mine")
async def mine(user: StudentUser, db: DB) -> dict[str, Any]:
    return ok(await service.my_reports(db, user))


@router.get("/by-session/{session_id}")
async def by_session(session_id: uuid.UUID, user: Me, db: DB) -> dict[str, Any]:
    r = await service.get_report(db, user, session_id=session_id)
    return ok({"id": str(r.id), **r.payload, "student": await service.report_owner(db, r)})


@router.get("/{report_id}")
async def get(report_id: uuid.UUID, user: Me, db: DB) -> dict[str, Any]:
    r = await service.get_report(db, user, report_id=report_id)
    return ok({"id": str(r.id), **r.payload})


@router.get("/groups/list")
async def groups(user: TeacherUser, db: DB) -> dict[str, Any]:
    from sqlalchemy import select

    from app.deps import can_see_group
    from app.users.models import User

    codes = sorted(
        {
            g
            for g in (await db.scalars(select(User.group_code).where(User.group_code.is_not(None)))).all()
            if g and can_see_group(user, g)
        }
    )
    return ok(codes)
