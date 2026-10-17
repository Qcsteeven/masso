"""Login, refresh-token rotation and logout."""

import secrets
from datetime import UTC, datetime, timedelta
from functools import lru_cache

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import SecurityEvent
from app.audit.service import record_security
from app.auth.models import RefreshToken
from app.auth.schemas import TokenOut, UserBrief
from app.auth.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.config import get_settings
from app.errors import AppError, ErrorCode
from app.users.models import User

INVALID = "Неверный email или пароль."


def brief(user: User) -> UserBrief:
    return UserBrief(
        id=user.id, email=user.email, full_name=user.full_name, roles=user.role_codes, group_code=user.group_code
    )


LOCKOUT_WINDOW = timedelta(minutes=15)


async def _throttled(db: AsyncSession, email: str, ip: str | None, now: datetime) -> bool:
    """Failures are counted per (email, client IP) and per IP: a stranger cannot lock out someone else's account
    from another address, and one address cannot sweep many accounts."""
    base = (
        select(func.count())
        .select_from(SecurityEvent)
        .where(SecurityEvent.kind == "login_failed", SecurityEvent.created_at > now - LOCKOUT_WINDOW)
    )
    ip_s = ip or "-"
    by_ip = await db.scalar(base.where(SecurityEvent.details["ip"].astext == ip_s)) or 0
    if by_ip >= get_settings().login_max_failures_per_ip:
        return True
    pair = await db.scalar(
        base.where(SecurityEvent.details["ip"].astext == ip_s, SecurityEvent.details["email"].astext == email[:255])
    )
    return (pair or 0) >= get_settings().login_max_failures


@lru_cache
def _dummy_hash() -> str:
    return hash_password(secrets.token_hex(16))


async def _issue(db: AsyncSession, user: User, now: datetime) -> tuple[TokenOut, str]:
    plain, digest = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id, token_hash=digest, expires_at=now + timedelta(days=get_settings().refresh_token_ttl_days)
        )
    )
    access = create_access_token(user.id, user.role_codes, now)
    out = TokenOut(access_token=access, expires_in=get_settings().access_token_ttl_min * 60, user=brief(user))
    return out, plain


async def login(db: AsyncSession, email: str, password: str, ip: str | None = None) -> tuple[TokenOut, str]:
    now = datetime.now(UTC)
    email_n = email.strip().lower()
    if await _throttled(db, email_n, ip, now):  # online guessing of the demo passwords
        raise AppError(
            ErrorCode.AUTH_INVALID_CREDENTIALS, "Слишком много неудачных попыток входа. Повторите через 15 минут."
        )
    user = await db.scalar(select(User).where(User.email == email_n))
    # verify against a dummy hash for unknown emails, so the response time does not reveal existing accounts
    valid = verify_password(password, user.password_hash if user else _dummy_hash())
    if user is None or not valid or user.status != "active":
        record_security(
            db,
            kind="login_failed",
            user_id=user.id if user else None,
            severity="info",
            details={"email": email_n[:255], "ip": ip or "-", "blocked": bool(user and user.status != "active")},
        )
        await db.commit()
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, INVALID)
    user.last_login_at = now
    out, plain = await _issue(db, user, now)
    await db.commit()
    return out, plain


async def refresh(db: AsyncSession, token: str | None) -> tuple[TokenOut, str]:
    now = datetime.now(UTC)
    if not token:
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Сессия истекла. Войдите снова.")
    row = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(token)))
    if row is None:
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Сессия истекла. Войдите снова.")
    if row.revoked_at is not None:
        # Reuse of a rotated token: revoke the whole family for this user.
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == row.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        record_security(db, kind="refresh_reuse", user_id=row.user_id, severity="warning")
        await db.commit()
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Сессия истекла. Войдите снова.")
    if row.expires_at <= now:
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Сессия истекла. Войдите снова.")
    user = await db.get(User, row.user_id)
    if user is None or user.status != "active":
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Учётная запись недоступна.")
    # atomic rotation: of two parallel refreshes with one token only the first gets a new pair
    rotated = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == row.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
        .returning(RefreshToken.id)
    )
    if rotated.first() is None:
        await db.rollback()
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Сессия истекла. Войдите снова.")
    out, plain = await _issue(db, user, now)
    await db.commit()
    return out, plain


async def logout(db: AsyncSession, token: str | None) -> None:
    if not token:
        return
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(token), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
