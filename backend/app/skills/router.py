import uuid
from typing import Any

from fastapi import APIRouter

from app.deps import DB, AuthorUser, Me, StudentUser, can_see_group
from app.errors import AppError, ErrorCode, ok
from app.profile_agent import service as profile
from app.skills import service
from app.skills.schemas import ImportIn, SkillCreate, SkillPatch, TargetsPut
from app.users.models import User

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/graph")
async def graph(user: Me, db: DB, domain: str | None = None) -> dict[str, Any]:
    return ok((await service.get_graph(db, domain)).model_dump(mode="json"))


@router.post("", status_code=201)
async def create(body: SkillCreate, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.create_skill(db, user.id, body)).model_dump(mode="json"))


@router.patch("/{skill_id}")
async def patch(skill_id: uuid.UUID, body: SkillPatch, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.patch_skill(db, user.id, skill_id, body)).model_dump(mode="json"))


@router.post("/import")
async def import_graph(body: ImportIn, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok(await service.import_graph(db, user.id, body.format, body.content, body.replace))


@router.put("/targets")
async def targets(body: TargetsPut, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok([t.model_dump(mode="json") for t in await service.set_targets(db, user.id, body)])


@router.get("/me")
async def me(user: StudentUser, db: DB, domain: str | None = None) -> dict[str, Any]:
    return ok([s.model_dump(mode="json") for s in await service.my_skills(db, user.id, domain)])


@router.get("/recommendations")
async def recommendations(user: Me, db: DB, domain: str = "devops", user_id: uuid.UUID | None = None) -> dict[str, Any]:
    target = user.id
    if user_id is not None and user_id != user.id:
        # Teachers may look at students of their own groups; admins at anyone.
        other = await db.get(User, user_id)
        if other is None or not can_see_group(user, other.group_code):
            raise AppError(ErrorCode.AUTH_FORBIDDEN, "Нет доступа к профилю этого обучающегося.")
        target = user_id
    elif not user.has("student"):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Укажите обучающегося (user_id).")
    return ok((await profile.recommendations(db, target, domain)).model_dump(mode="json"))
