import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.seed import seed_core
from app.users.models import Role, User

pytestmark = pytest.mark.db


async def test_seed_idempotent(db: AsyncSession) -> None:
    users = await db.scalar(select(func.count()).select_from(User))
    await seed_core(db)
    await db.commit()
    assert await db.scalar(select(func.count()).select_from(User)) == users
    assert await db.scalar(select(func.count()).select_from(Role)) == 5


async def test_seed_syncs_llm_providers_from_env(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM_* changed in .env after the first seed reach llm_providers on the next `make seed`."""
    from app.config import get_settings
    from app.llm_gateway.models import LLMProvider

    monkeypatch.setenv("LLM_EXTERNAL_BASE_URL", "http://gpt2giga:8090/v1")
    monkeypatch.setenv("LLM_EXTERNAL_CHAT_MODEL", "GigaChat")
    monkeypatch.setenv("LLM_EXTERNAL_EMBED_MODEL", "")
    monkeypatch.setenv("LLM_LOCAL_CHAT_MODEL", "qwen3:8b")
    get_settings.cache_clear()
    try:
        ext = await db.scalar(select(LLMProvider).filter_by(code="external"))
        assert ext is not None
        ext.embeddings_model = "kept-when-env-empty"
        await seed_core(db)
        await db.commit()
    finally:
        get_settings.cache_clear()
    ext = await db.scalar(select(LLMProvider).filter_by(code="external"))
    local = await db.scalar(select(LLMProvider).filter_by(code="local"))
    assert ext is not None and local is not None
    assert (ext.base_url, ext.chat_model, ext.embeddings_model) == (
        "http://gpt2giga:8090/v1",
        "GigaChat",
        "kept-when-env-empty",
    )
    assert local.chat_model == "qwen3:8b"
    assert await db.scalar(select(func.count()).select_from(LLMProvider)) == 3
