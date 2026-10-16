import pytest
from httpx import AsyncClient
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AgentLog, AuditLog
from app.llm_gateway.fake import FakeFactory, FakeProvider
from app.llm_gateway.gateway import LLMGateway
from app.llm_gateway.models import LLMSettings

pytestmark = pytest.mark.db


class Legend(BaseModel):
    title: str
    text: str


async def _mode(db: AsyncSession, mode: str) -> None:
    s = await db.get(LLMSettings, 1)
    assert s is not None
    s.generation_mode = mode
    await db.commit()


async def test_external_fails_local_answers(db: AsyncSession) -> None:
    await _mode(db, "external")
    local = FakeProvider("local", "local", lambda m: {"title": "T", "text": "Легенда"})
    gw = LLMGateway(db, FakeFactory(external=FakeProvider("external", "external", rate_limited=True), local=local))
    res = await gw.complete_json("legend", [{"role": "user", "content": "x"}], Legend)
    assert res is not None and res.provider == "local" and res.value.text == "Легенда"
    await db.commit()
    logs = (await db.scalars(select(AgentLog).order_by(AgentLog.created_at))).all()
    assert [(log.provider, log.ok) for log in logs] == [("external", False), ("local", True)]


async def test_all_down_returns_none_template(db: AsyncSession) -> None:
    await _mode(db, "external")
    gw = LLMGateway(db, FakeFactory())  # every provider fails
    assert await gw.complete_json("legend", [{"role": "user", "content": "x"}], Legend) is None


async def test_template_mode_skips_providers(db: AsyncSession) -> None:
    await _mode(db, "template")
    ext = FakeProvider("external", "external", lambda m: {"title": "a", "text": "b"})
    gw = LLMGateway(db, FakeFactory(external=ext))
    assert await gw.complete_json("legend", [{"role": "user", "content": "x"}], Legend) is None
    assert ext.calls == []


async def test_invalid_json_retried_with_error_text(db: AsyncSession) -> None:
    await _mode(db, "local")
    answers = iter(['{"title": "без текста"}', '```json\n{"title": "T", "text": "ok"}\n```'])
    local = FakeProvider("local", "local", lambda m: next(answers))
    gw = LLMGateway(db, FakeFactory(local=local))
    res = await gw.complete_json("legend", [{"role": "user", "content": "x"}], Legend)
    assert res is not None and res.value.text == "ok"
    assert "не прошёл проверку" in local.calls[1][-1]["content"]


async def test_embed_falls_back_to_hash(db: AsyncSession) -> None:
    await _mode(db, "template")
    res = await LLMGateway(db, FakeFactory()).embed(["Сервис недоступен"])
    assert res.source == "hash" and len(res.vectors[0]) == 1024


async def test_switch_mode_api(
    client: AsyncClient, as_admin: dict[str, str], as_teacher: dict[str, str], db: AsyncSession
) -> None:
    r = await client.post(
        "/api/admin/llm/switch-mode", headers=as_admin, json={"mode": "local", "reason": "429 у провайдера"}
    )
    assert r.status_code == 200 and r.json()["data"]["generation_mode"] == "local"
    st = (await client.get("/api/llm/status", headers=as_teacher)).json()["data"]
    assert st["generation_mode"] == "local" and st["reason"] == "429 у провайдера"
    a = await db.scalar(select(AuditLog).where(AuditLog.action == "llm.switch_mode"))
    assert a is not None and a.before == {"generation_mode": "template"}
    r = await client.post("/api/admin/llm/switch-mode", headers=as_teacher, json={"mode": "external", "reason": "xxx"})
    assert r.status_code == 403
    r = await client.post("/api/admin/llm/switch-mode", headers=as_admin, json={"mode": "external"})
    assert r.status_code == 422
