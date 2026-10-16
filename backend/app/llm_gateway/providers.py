"""Provider adapters. Every real provider is reached through the OpenAI-compatible API (ТЗ 4.1.3)."""

import hashlib
import itertools
import math
import re
import time
from dataclasses import dataclass
from typing import Any, Protocol


class ProviderError(Exception):
    """Provider failed (network, timeout, 429, 5xx, empty answer)."""

    def __init__(self, message: str, *, rate_limited: bool = False) -> None:
        super().__init__(message)
        self.rate_limited = rate_limited


@dataclass(frozen=True)
class ChatResult:
    text: str
    tokens_in: int
    tokens_out: int
    duration_ms: int


class Provider(Protocol):
    code: str
    mode: str

    async def chat(
        self, messages: list[dict[str, str]], *, json_mode: bool, temperature: float, max_tokens: int
    ) -> ChatResult: ...

    async def embed(self, texts: list[str]) -> list[list[float]]: ...

    async def ping(self) -> float: ...


class OpenAICompatProvider:
    def __init__(
        self, code: str, mode: str, base_url: str, api_key: str, chat_model: str, embed_model: str, timeout: float
    ) -> None:
        from openai import AsyncOpenAI

        self.code, self.mode = code, mode
        self.chat_model, self.embed_model = chat_model, embed_model
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key or "none", timeout=timeout, max_retries=0)

    async def chat(
        self, messages: list[dict[str, str]], *, json_mode: bool, temperature: float, max_tokens: int
    ) -> ChatResult:
        import openai

        if not self.chat_model:
            raise ProviderError(f"{self.code}: модель не настроена")
        kwargs: dict[str, Any] = {
            "model": self.chat_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        t0 = time.perf_counter()
        try:
            resp = await self._client.chat.completions.create(**kwargs)
        except openai.RateLimitError as exc:
            raise ProviderError(f"{self.code}: 429 rate limit", rate_limited=True) from exc
        except openai.APIError as exc:
            raise ProviderError(f"{self.code}: {type(exc).__name__}: {str(exc)[:200]}") from exc
        except Exception as exc:  # network errors from httpx etc.
            raise ProviderError(f"{self.code}: {type(exc).__name__}") from exc
        text = (resp.choices[0].message.content or "") if resp.choices else ""
        if not text.strip():
            raise ProviderError(f"{self.code}: пустой ответ")
        usage = resp.usage
        return ChatResult(
            text=text,
            tokens_in=usage.prompt_tokens if usage else 0,
            tokens_out=usage.completion_tokens if usage else 0,
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        import openai

        if not self.embed_model:
            raise ProviderError(f"{self.code}: модель эмбеддингов не настроена")
        try:
            resp = await self._client.embeddings.create(model=self.embed_model, input=texts)
        except openai.RateLimitError as exc:
            raise ProviderError(f"{self.code}: 429 rate limit", rate_limited=True) from exc
        except Exception as exc:
            raise ProviderError(f"{self.code}: {type(exc).__name__}") from exc
        return [list(d.embedding) for d in resp.data]

    async def ping(self) -> float:
        t0 = time.perf_counter()
        try:
            await self._client.models.list()
        except Exception as exc:
            raise ProviderError(f"{self.code}: {type(exc).__name__}") from exc
        return time.perf_counter() - t0


_TOKEN = re.compile(r"\w+", re.UNICODE)


def hash_embedding(text: str, dim: int = 1024) -> list[float]:
    """Deterministic local embedding (hashing trick over word uni/bigrams and char trigrams).

    Used when no embeddings provider is reachable (template mode). Good enough to detect near-duplicate
    legends (cosine ≥ 0.90) but not for semantic grading.
    """
    vec = [0.0] * dim
    words = [w.lower() for w in _TOKEN.findall(text)]
    feats: list[str] = [*words, *(f"{a} {b}" for a, b in itertools.pairwise(words))]
    joined = " ".join(words)
    feats.extend(joined[i : i + 3] for i in range(max(0, len(joined) - 2)))
    for f in feats:
        h = hashlib.blake2b(f.encode(), digest_size=8).digest()
        idx = int.from_bytes(h[:4], "little") % dim
        sign = 1.0 if h[4] & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def fit_dim(vec: list[float], dim: int) -> list[float]:
    """Pad or truncate (with renormalisation) a provider embedding to the pgvector column size."""
    if len(vec) == dim:
        return vec
    v = vec[:dim] + [0.0] * max(0, dim - len(vec))
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
