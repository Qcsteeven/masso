import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.assessment_agent import hints, selfcheck, service
from app.deps import DB, StudentUser
from app.errors import ok
from app.sessions.service import check_access, get_session

router = APIRouter(prefix="/api/sessions", tags=["assessment"])


class HintIn(BaseModel):
    question: str = Field(default="", max_length=1000)


@router.post("/{session_id}/hints")
async def hint(session_id: uuid.UUID, body: HintIn, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s, write=True)
    return ok(await hints.request_hint(db, s, body.question))


@router.post("/{session_id}/self-check")
async def self_check(session_id: uuid.UUID, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s, write=True)
    return ok(await selfcheck.self_check(db, s))


@router.post("/{session_id}/submit")
async def submit(session_id: uuid.UUID, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await get_session(db, session_id)
    await check_access(db, user, s, write=True)
    return ok(await service.submit(db, s))
