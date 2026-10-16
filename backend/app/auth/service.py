"""Login, refresh-token rotation and logout."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import record_security
from app.auth.models import RefreshToken
from app.auth.schemas import TokenOut, UserBrief
from app.auth.security import create_access_token, hash_refresh_token, new_refresh_token, verify_password
from app.config import get_settings
from app.errors import AppError, ErrorCode
from app.users.models import User

INVALID = "Неверный email или пароль."


def brief(user: User) -> UserBrief:
    return UserBrief(
        id=user.id, email=user.email, full_name=user.full_name, roles=user.role_codes, group_code=user.group_code
    )


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
    user = await db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or not verify_password(password, user.password_hash) or user.status != "active":
        record_security(
            db,
            kind="login_failed",
            user_id=user.id if user else None,
            severity="info",
            details={"email": email[:255], "ip": ip, "blocked": bool(user and user.status != "active")},
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
    row.revoked_at = now
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
