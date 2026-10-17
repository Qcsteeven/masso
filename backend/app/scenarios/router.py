import uuid
from typing import Any

from fastapi import APIRouter

from app.deps import DB, AuthorUser, Me, StaffUser, StudentUser, can_see_group
from app.errors import AppError, ErrorCode, ok
from app.scenarios import service
from app.scenarios.schemas import AssignmentIn, GenerateIn, TemplateIn
from app.scenarios.spec import spec_json_schema

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("/templates")
async def templates(user: Me, db: DB, domain: str | None = None) -> dict[str, Any]:
    return ok([t.model_dump(mode="json") for t in await service.list_templates(db, user, domain)])


@router.get("/spec-schema")
async def schema(user: AuthorUser) -> dict[str, Any]:
    return ok(spec_json_schema())


@router.get("/templates/{template_id}")
async def template(template_id: uuid.UUID, user: StaffUser, db: DB) -> dict[str, Any]:
    return ok(service.full(await service.get_template(db, template_id)).model_dump(mode="json"))


@router.post("/templates", status_code=201)
async def create(body: TemplateIn, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.create_template(db, user, body.spec)).model_dump(mode="json"))


@router.patch("/templates/{template_id}")
async def update(template_id: uuid.UUID, body: TemplateIn, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.update_template(db, user, template_id, body.spec)).model_dump(mode="json"))


@router.post("/templates/{template_id}/validate")
async def validate(template_id: uuid.UUID, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.validate_template(db, user, template_id)).model_dump(mode="json"))


@router.post("/templates/{template_id}/publish")
async def publish(template_id: uuid.UUID, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.publish_template(db, user, template_id)).model_dump(mode="json"))


@router.post("/templates/{template_id}/archive")
async def archive(template_id: uuid.UUID, user: AuthorUser, db: DB) -> dict[str, Any]:
    return ok((await service.archive_template(db, user, template_id)).model_dump(mode="json"))


@router.post("/generate", status_code=201)
async def generate(body: GenerateIn, user: StudentUser, db: DB) -> dict[str, Any]:
    return ok((await service.generate(db, user, body.template_id)).model_dump(mode="json"))


@router.get("/runs/{run_id}")
async def run(run_id: uuid.UUID, user: Me, db: DB) -> dict[str, Any]:
    res = await service.run_public(db, user, run_id)
    return ok(res if isinstance(res, dict) else res.model_dump(mode="json"))


@router.post("/assignments", status_code=201)
async def assign(body: AssignmentIn, user: StaffUser, db: DB) -> dict[str, Any]:
    if body.group_code and user.has("teacher") and not can_see_group(user, body.group_code):
        raise AppError(ErrorCode.AUTH_FORBIDDEN, "Можно назначать сценарии только своей группе.")
    return ok((await service.create_assignment(db, user, body)).model_dump(mode="json"))


@router.get("/assignments/me")
async def my_assignments(user: StudentUser, db: DB) -> dict[str, Any]:
    return ok([a.model_dump(mode="json") for a in await service.my_assignments(db, user)])


@router.get("/assignments")
async def assignments(user: StaffUser, db: DB, group: str | None = None) -> dict[str, Any]:
    return ok([a.model_dump(mode="json") for a in await service.list_assignments(db, group)])
