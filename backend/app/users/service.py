import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.audit.service import record_audit
from app.auth.security import hash_password
from app.deps import CurrentUser
from app.errors import AppError, ErrorCode
from app.users.models import Role, User, UserRole
from app.users.schemas import RolesPut, UserCreate, UserOut, UserPatch


def to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        group_code=u.group_code,
        status=u.status,
        roles=u.role_codes,
        last_login_at=u.last_login_at,
        created_at=u.created_at,
    )


async def _roles_by_code(db: AsyncSession, codes: Sequence[str]) -> list[Role]:
    rows = list((await db.scalars(select(Role).where(Role.code.in_(codes)))).all())
    if len(rows) != len(set(codes)):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Указана неизвестная роль.")
    return rows


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError(ErrorCode.NOT_FOUND, "Пользователь не найден.")
    return user


async def list_users(
    db: AsyncSession, *, q: str | None, role: str | None, group: str | None, status: str | None, limit: int, offset: int
) -> tuple[list[UserOut], int]:
    stmt = select(User)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(User.full_name).like(like), User.email.like(like)))
    if role:
        stmt = stmt.where(User.id.in_(select(UserRole.user_id).join(Role).where(Role.code == role)))
    if group:
        stmt = stmt.where(User.group_code == group)
    if status:
        stmt = stmt.where(User.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await db.scalars(stmt.order_by(User.full_name).limit(limit).offset(offset))).all()
    return [to_out(u) for u in rows], total


async def create_user(db: AsyncSession, actor: CurrentUser, body: UserCreate) -> UserOut:
    roles = await _roles_by_code(db, body.roles)
    user = User(
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        group_code=body.group_code,
        status="active",
        roles=[UserRole(role=r, role_id=r.id) for r in roles],
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise AppError(ErrorCode.VALIDATION_ERROR, "Пользователь с таким email уже существует.") from None
    record_audit(
        db,
        actor_id=actor.id,
        action="user.create",
        object_type="user",
        object_id=str(user.id),
        after={"email": user.email, "roles": sorted(body.roles), "group_code": user.group_code},
    )
    await db.commit()
    await db.refresh(user)
    return to_out(user)


async def patch_user(db: AsyncSession, actor: CurrentUser, user_id: uuid.UUID, body: UserPatch) -> UserOut:
    user = await get_user(db, user_id)
    before = {"full_name": user.full_name, "group_code": user.group_code, "status": user.status}
    data = body.model_dump(exclude_unset=True, exclude={"reason"})
    if user.id == actor.id and data.get("status") == "blocked":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Нельзя заблокировать собственную учётную запись.")
    for k, v in data.items():
        setattr(user, k, v)
    after = {"full_name": user.full_name, "group_code": user.group_code, "status": user.status}
    if after != before:
        record_audit(
            db,
            actor_id=actor.id,
            action="user.update",
            object_type="user",
            object_id=str(user.id),
            before=before,
            after=after,
            reason=body.reason,
        )
    await db.commit()
    return to_out(user)


async def revoke_sessions(db: AsyncSession, actor: CurrentUser, user_id: uuid.UUID) -> int:
    """Revoke all refresh tokens of the user: they must log in again after the access token expires."""
    from datetime import UTC, datetime

    from sqlalchemy import update

    from app.auth.models import RefreshToken

    user = await get_user(db, user_id)
    res = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    n = int(getattr(res, "rowcount", 0) or 0)
    record_audit(
        db,
        actor_id=actor.id,
        action="user.revoke_sessions",
        object_type="user",
        object_id=str(user.id),
        after={"revoked": n},
    )
    await db.commit()
    return n


async def put_roles(db: AsyncSession, actor: CurrentUser, user_id: uuid.UUID, body: RolesPut) -> UserOut:
    user = await get_user(db, user_id)
    before = user.role_codes
    if user.id == actor.id and "admin" in before and "admin" not in body.roles:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Нельзя снять роль администратора с самого себя.")
    roles = await _roles_by_code(db, body.roles)
    user.roles = [UserRole(user_id=user.id, role_id=r.id, role=r) for r in roles]
    await db.flush()
    after = sorted(r.code for r in roles)
    if after != before:
        record_audit(
            db,
            actor_id=actor.id,
            action="user.roles",
            object_type="user",
            object_id=str(user.id),
            before={"roles": before},
            after={"roles": after},
            reason=body.reason,
        )
    await db.commit()
    await db.refresh(user)
    return to_out(user)


async def user_audit(db: AsyncSession, user_id: uuid.UUID, limit: int = 50) -> list[AuditLog]:
    rows = await db.scalars(
        select(AuditLog)
        .where(AuditLog.object_type == "user", AuditLog.object_id == str(user_id))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return list(rows.all())
