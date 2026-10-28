"""JSON mode switch per provider: GigaChat behind gpt2giga rejects response_format=json_object."""

from types import SimpleNamespace
from typing import Any

import pytest

from app.config import get_settings
from app.llm_gateway.gateway import default_factory
from app.llm_gateway.models import LLMProvider
from app.llm_gateway.providers import OpenAICompatProvider


def _capture(provider: OpenAICompatProvider) -> dict[str, Any]:
    seen: dict[str, Any] = {}

    async def create(**kwargs: Any) -> Any:
        seen.update(kwargs)
        msg = SimpleNamespace(content='{"ok": true}')
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)], usage=None)

    provider._client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))  # type: ignore[assignment]
    return seen


@pytest.mark.parametrize(("json_mode", "sent"), [(True, True), (False, False)])
async def test_response_format_follows_provider_json_mode(json_mode: bool, sent: bool) -> None:
    p = OpenAICompatProvider("external", "external", "http://x/v1", "k", "m", "", 5, json_mode=json_mode)
    seen = _capture(p)
    res = await p.chat([{"role": "user", "content": "hi"}], json_mode=True, temperature=0.1, max_tokens=10)
    assert res.text == '{"ok": true}'
    assert ("response_format" in seen) is sent


def test_factory_takes_json_mode_from_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_EXTERNAL_JSON_MODE", "false")
    get_settings.cache_clear()
    try:
        ext = default_factory(LLMProvider(code="external", mode="external", base_url="http://x/v1", chat_model="m"))
        loc = default_factory(LLMProvider(code="local", mode="local", base_url="http://y/v1", chat_model="m"))
    finally:
        get_settings.cache_clear()
    assert isinstance(ext, OpenAICompatProvider) and isinstance(loc, OpenAICompatProvider)
    assert ext.json_mode is False
    assert loc.json_mode is True
