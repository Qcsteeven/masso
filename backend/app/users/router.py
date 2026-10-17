import uuid
from typing import Any

from fastapi import APIRouter, Query

from app.deps import DB, AdminUser
from app.errors import ok
from app.users import service
from app.users.schemas import AuditOut, RolesPut, UserCreate, UserPatch

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_users(
    admin: AdminUser,
    db: DB,
    q: str | None = None,
    role: str | None = None,
    group: str | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    items, total = await service.list_users(db, q=q, role=role, group=group, status=status, limit=limit, offset=offset)
    return ok({"items": [i.model_dump(mode="json") for i in items], "total": total})


@router.post("", status_code=201)
async def create_user(body: UserCreate, admin: AdminUser, db: DB) -> dict[str, Any]:
    return ok((await service.create_user(db, admin, body)).model_dump(mode="json"))


@router.patch("/{user_id}")
async def patch_user(user_id: uuid.UUID, body: UserPatch, admin: AdminUser, db: DB) -> dict[str, Any]:
    return ok((await service.patch_user(db, admin, user_id, body)).model_dump(mode="json"))


@router.put("/{user_id}/roles")
async def put_roles(user_id: uuid.UUID, body: RolesPut, admin: AdminUser, db: DB) -> dict[str, Any]:
    return ok((await service.put_roles(db, admin, user_id, body)).model_dump(mode="json"))


@router.post("/{user_id}/revoke-sessions")
async def revoke_sessions(user_id: uuid.UUID, admin: AdminUser, db: DB) -> dict[str, Any]:
    return ok({"revoked": await service.revoke_sessions(db, admin, user_id)})


@router.get("/{user_id}/audit")
async def audit(user_id: uuid.UUID, admin: AdminUser, db: DB) -> dict[str, Any]:
    rows = await service.user_audit(db, user_id)
    return ok([AuditOut.model_validate(r, from_attributes=True).model_dump(mode="json") for r in rows])
