"""Common dependencies: DB session, current user, role checks."""

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_token
from app.db import get_db
from app.errors import AppError, ErrorCode
from app.users.models import User

DB = Annotated[AsyncSession, Depends(get_db)]

ROLES = ("student", "teacher", "methodist", "admin", "sysadmin")


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID
    roles: frozenset[str]
    group_code: str | None
    full_name: str
    email: str

    def has(self, *roles: str) -> bool:
        return bool(self.roles.intersection(roles))


def _bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(request: Request, db: DB) -> CurrentUser:
    token = _bearer(request)
    if not token:
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Требуется вход в систему.")
    try:
        claims = decode_token(token, "access")
        user_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Сессия истекла. Войдите снова.") from None
    user = await db.get(User, user_id)
    if user is None or user.status != "active":
        raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Учётная запись недоступна.")
    return CurrentUser(
        id=user.id,
        roles=frozenset(user.role_codes),
        group_code=user.group_code,
        full_name=user.full_name,
        email=user.email,
    )


Me = Annotated[CurrentUser, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[[CurrentUser], Awaitable[CurrentUser]]:
    async def checker(user: Me) -> CurrentUser:
        if not user.has(*roles):
            raise AppError(ErrorCode.AUTH_FORBIDDEN, "Недостаточно прав для этого действия.")
        return user

    return checker


StudentUser = Annotated[CurrentUser, Depends(require_roles("student"))]
TeacherUser = Annotated[CurrentUser, Depends(require_roles("teacher"))]
MethodistUser = Annotated[CurrentUser, Depends(require_roles("methodist"))]
AdminUser = Annotated[CurrentUser, Depends(require_roles("admin"))]
OpsUser = Annotated[CurrentUser, Depends(require_roles("admin", "sysadmin"))]
StaffUser = Annotated[CurrentUser, Depends(require_roles("teacher", "methodist", "admin"))]
AuthorUser = Annotated[CurrentUser, Depends(require_roles("methodist", "admin"))]
