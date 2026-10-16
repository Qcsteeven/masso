import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.audit.service import record_audit
from app.deps import DB, AdminUser, Me
from app.errors import AppError, ErrorCode, ok
from app.llm_gateway import gateway as gw
from app.llm_gateway.models import LLMProvider, LLMSettings
from app.llm_gateway.providers import ProviderError

router = APIRouter(prefix="/api/admin/llm", tags=["admin-llm"])
status_router = APIRouter(prefix="/api/llm", tags=["llm"])
routers = [router, status_router]

Mode = Literal["external", "local", "template"]


class SwitchIn(BaseModel):
    mode: Mode
    reason: str = Field(min_length=3, max_length=500)


class ProviderPatch(BaseModel):
    base_url: str | None = Field(default=None, max_length=255)
    chat_model: str | None = Field(default=None, max_length=128)
    embeddings_model: str | None = Field(default=None, max_length=128)
    status: Literal["active", "standby", "disabled"] | None = None
    priority: int | None = Field(default=None, ge=0, le=100)


def _provider_out(p: LLMProvider) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "code": p.code,
        "mode": p.mode,
        "base_url": p.base_url,
        "chat_model": p.chat_model,
        "embeddings_model": p.embeddings_model,
        "api_key_env": p.api_key_env,
        "priority": p.priority,
        "status": p.status,
        "last_error": p.last_error,
        "last_error_at": p.last_error_at.isoformat() if p.last_error_at else None,
    }


async def _settings(db: DB) -> LLMSettings:
    row = await db.get(LLMSettings, 1)
    if row is None:
        row = LLMSettings(id=1, generation_mode="template")
        db.add(row)
        await db.flush()
    return row


@status_router.get("/status")
async def status(user: Me, db: DB) -> dict[str, Any]:
    s = await _settings(db)
    return ok({"generation_mode": s.generation_mode, "updated_at": s.updated_at.isoformat(), "reason": s.reason})


@router.get("/providers")
async def providers(admin: AdminUser, db: DB) -> dict[str, Any]:
    rows = (await db.scalars(select(LLMProvider).order_by(LLMProvider.priority))).all()
    s = await _settings(db)
    return ok(
        {
            "generation_mode": s.generation_mode,
            "updated_at": s.updated_at.isoformat(),
            "reason": s.reason,
            "providers": [_provider_out(p) for p in rows],
        }
    )


@router.patch("/providers/{provider_id}")
async def patch_provider(provider_id: uuid.UUID, body: ProviderPatch, admin: AdminUser, db: DB) -> dict[str, Any]:
    p = await db.get(LLMProvider, provider_id)
    if p is None:
        raise AppError(ErrorCode.NOT_FOUND, "Провайдер не найден.")
    before = _provider_out(p)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    record_audit(
        db,
        actor_id=admin.id,
        action="llm.provider",
        object_type="llm_provider",
        object_id=p.code,
        before=before,
        after=_provider_out(p),
    )
    await db.commit()
    return ok(_provider_out(p))


@router.post("/switch-mode")
async def switch_mode(body: SwitchIn, admin: AdminUser, db: DB) -> dict[str, Any]:
    s = await _settings(db)
    before = {"generation_mode": s.generation_mode}
    s.generation_mode, s.reason, s.updated_by, s.updated_at = body.mode, body.reason, admin.id, datetime.now(UTC)
    record_audit(
        db,
        actor_id=admin.id,
        action="llm.switch_mode",
        object_type="llm_settings",
        object_id="1",
        before=before,
        after={"generation_mode": body.mode},
        reason=body.reason,
    )
    await db.commit()
    return ok({"generation_mode": s.generation_mode, "updated_at": s.updated_at.isoformat(), "reason": s.reason})


@router.get("/health")
async def health(admin: AdminUser, db: DB) -> dict[str, Any]:
    rows = (await db.scalars(select(LLMProvider).order_by(LLMProvider.priority))).all()

    async def probe(p: LLMProvider) -> dict[str, Any]:
        if p.mode == "template":
            return {"code": p.code, "ok": True, "latency_ms": 0, "error": None}
        if not p.base_url:
            return {"code": p.code, "ok": False, "latency_ms": None, "error": "адрес не настроен"}
        try:
            latency = await asyncio.wait_for(gw._factory(p).ping(), timeout=10)
            return {"code": p.code, "ok": True, "latency_ms": int(latency * 1000), "error": None}
        except (ProviderError, TimeoutError) as exc:
            return {"code": p.code, "ok": False, "latency_ms": None, "error": str(exc)[:200] or "таймаут"}

    return ok(await asyncio.gather(*(probe(p) for p in rows)))
