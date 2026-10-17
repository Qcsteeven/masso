"""Sandbox profiles from the DB and the active-session limit."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.errors import AppError, ErrorCode
from app.sandbox.manager import Profile
from app.sandbox.models import SandboxProfile

ACTIVE_STATUSES = ("starting", "active", "paused", "submitted", "checking")


async def load_profile(db: AsyncSession, code: str) -> Profile:
    row = await db.get(SandboxProfile, code)
    if row is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Профиль песочницы {code} не найден.")
    return Profile(
        code=row.code,
        image=row.image or get_settings().sandbox_image,
        cpu=float(row.cpu),
        mem_mb=row.mem_mb,
        pids_limit=row.pids_limit,
        storage_mb=row.storage_mb,
        network_policy=row.network_policy,
    )


async def ensure_capacity(db: AsyncSession) -> None:
    from app.sessions.models import LearningSession

    n = await db.scalar(
        select(func.count())
        .select_from(LearningSession)
        .where(LearningSession.kind == "container", LearningSession.status.in_(ACTIVE_STATUSES))
    )
    if (n or 0) >= get_settings().sandbox_max_sessions:
        raise AppError(
            ErrorCode.SANDBOX_LIMIT_EXCEEDED,
            "Все учебные среды заняты. Попробуйте запустить сценарий через несколько минут.",
        )
