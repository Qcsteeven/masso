"""FakeLLM: deterministic provider for tests and offline demos (no network)."""

import json
from collections.abc import Callable
from typing import Any

from app.llm_gateway.models import LLMProvider
from app.llm_gateway.providers import ChatResult, Provider, ProviderError, hash_embedding

Responder = Callable[[list[dict[str, str]]], str | dict[str, Any] | list[Any]]


class FakeProvider:
    def __init__(
        self,
        code: str,
        mode: str,
        responder: Responder | None = None,
        *,
        fail: bool = False,
        rate_limited: bool = False,
        embed_fail: bool = False,
    ) -> None:
        self.code, self.mode = code, mode
        self.responder = responder
        self.fail, self.rate_limited, self.embed_fail = fail, rate_limited, embed_fail
        self.calls: list[list[dict[str, str]]] = []

    async def chat(
        self, messages: list[dict[str, str]], *, json_mode: bool, temperature: float, max_tokens: int
    ) -> ChatResult:
        self.calls.append(messages)
        if self.fail or self.rate_limited:
            raise ProviderError(f"{self.code}: недоступен", rate_limited=self.rate_limited)
        out = self.responder(messages) if self.responder else {}
        text = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False)
        return ChatResult(
            text=text, tokens_in=sum(len(m["content"]) for m in messages) // 4, tokens_out=len(text) // 4, duration_ms=1
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if self.fail or self.embed_fail:
            raise ProviderError(f"{self.code}: недоступен")
        return [hash_embedding(t, 1024) for t in texts]

    async def ping(self) -> float:
        if self.fail:
            raise ProviderError(f"{self.code}: недоступен")
        return 0.001


class FakeFactory:
    """Maps provider code -> FakeProvider; unknown codes fail."""

    def __init__(self, **providers: FakeProvider) -> None:
        self.providers = providers

    def __call__(self, row: LLMProvider) -> Provider:
        return self.providers.get(row.code) or FakeProvider(row.code, row.mode, fail=True)
