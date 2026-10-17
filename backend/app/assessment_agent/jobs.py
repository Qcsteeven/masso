"""Worker job: auto-submit sessions whose time limit is over."""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.assessment_agent.service import submit
from app.db import get_sessionmaker
from app.errors import AppError
from app.sessions.models import LearningSession
from app.worker import register

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


register("time_limit", time_limit_job)
