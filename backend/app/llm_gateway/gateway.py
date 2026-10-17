"""LLM Gateway (spec §8, ТЗ 4.1.3): one entry point, fallback external → local → template.

`complete_json` returns None when the chain ends in template mode (or every provider failed): the caller then
uses its template path (pre-generated variants, hint ladder). Each provider call is written to agent_logs.
"""

import json
import logging
import os
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ValidationError
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AgentLog
from app.config import get_settings
from app.db import get_sessionmaker
from app.llm_gateway.models import LLMProvider, LLMSettings
from app.llm_gateway.providers import OpenAICompatProvider, Provider, ProviderError, fit_dim, hash_embedding

log = logging.getLogger("masso.llm")

CHAIN = {"external": ["external", "local"], "local": ["local"], "template": []}


@dataclass(frozen=True)
class LLMResult[T: BaseModel]:
    value: T
    mode: str
    provider: str


@dataclass(frozen=True)
class EmbedResult:
    vectors: list[list[float]]
    source: str  # provider code or "hash"


ProviderFactory = Callable[[LLMProvider], Provider]


def default_factory(row: LLMProvider) -> Provider:
    s = get_settings()
    key = os.environ.get(row.api_key_env, "") if row.api_key_env else ""
    return OpenAICompatProvider(
        row.code, row.mode, row.base_url, key, row.chat_model, row.embeddings_model, s.llm_timeout_sec
    )


_factory: ProviderFactory = default_factory


def set_provider_factory(factory: ProviderFactory | None) -> None:
    """Tests inject FakeLLM providers here."""
    global _factory
    _factory = factory or default_factory


def _extract_json(text: str) -> Any:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start = min((i for i in (text.find("{"), text.find("[")) if i >= 0), default=-1)
    if start > 0:
        text = text[start:]
    return json.loads(text)


MARK_INTERVAL_SEC = 30.0
_last_marked: dict[str, float] = {}


async def _mark_failed(row: LLMProvider, exc: Exception) -> None:
    """Store the provider error in its own short transaction.

    Updating the row inside the caller's transaction would lock it until that transaction ends; generation keeps
    its transaction open through dynamic validation, so while a provider is down every concurrent generation
    waited for the previous one (found by the load test). Written at most once per MARK_INTERVAL_SEC per provider
    so that a burst of failing requests does not take a second pool connection each.
    """
    now = time.monotonic()
    if now - _last_marked.get(row.code, -MARK_INTERVAL_SEC) < MARK_INTERVAL_SEC:
        return
    _last_marked[row.code] = now
    try:
        async with get_sessionmaker()() as s:
            await s.execute(text("SET LOCAL lock_timeout = '2s'"))
            await s.execute(
                update(LLMProvider)
                .where(LLMProvider.id == row.id)
                .values(last_error=str(exc)[:500], last_error_at=datetime.now(UTC))
            )
            await s.commit()
    except Exception:  # the status field is informational; never fail the request because of it
        log.warning("could not store provider error", extra={"extra": {"provider": row.code}})


class LLMGateway:
    def __init__(self, db: AsyncSession, factory: ProviderFactory | None = None) -> None:
        self.db = db
        self.factory = factory or _factory

    async def mode(self) -> str:
        row = await self.db.get(LLMSettings, 1)
        return row.generation_mode if row else get_settings().llm_generation_mode

    async def _providers(self, codes: list[str]) -> list[tuple[LLMProvider, Provider]]:
        if not codes:
            return []
        rows = (
            await self.db.scalars(
                select(LLMProvider).where(LLMProvider.code.in_(codes), LLMProvider.status != "disabled")
            )
        ).all()
        order = {c: i for i, c in enumerate(codes)}
        return [(r, self.factory(r)) for r in sorted(rows, key=lambda r: order[r.code])]

    def _log(
        self,
        *,
        agent: str,
        task: str,
        mode: str,
        provider: str,
        ok: bool,
        run_id: uuid.UUID | None,
        session_id: uuid.UUID | None,
        input_summary: str,
        output_summary: str = "",
        tokens_in: int = 0,
        tokens_out: int = 0,
        duration_ms: int = 0,
        error: str | None = None,
    ) -> None:
        self.db.add(
            AgentLog(
                agent=agent,
                task=task,
                mode=mode,
                provider=provider,
                ok=ok,
                run_id=run_id,
                session_id=session_id,
                input_summary=input_summary[:500],
                output_summary=output_summary[:500],
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                duration_ms=duration_ms,
                error=error,
            )
        )

    async def complete_json[T: BaseModel](
        self,
        task: str,
        messages: list[dict[str, str]],
        schema: type[T],
        *,
        agent: str = "scenario",
        run_id: uuid.UUID | None = None,
        session_id: uuid.UUID | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        validate: Callable[[T], Awaitable[None] | None] | None = None,
    ) -> LLMResult[T] | None:
        mode = await self.mode()
        schema_hint = json.dumps(schema.model_json_schema(), ensure_ascii=False)
        sys_msg = {
            "role": "system",
            "content": "Отвечай только JSON-объектом без пояснений, строго по схеме:\n" + schema_hint,
        }
        base = [sys_msg, *messages]
        summary = messages[-1]["content"][:300] if messages else task
        for row, provider in await self._providers(CHAIN.get(mode, [])):
            msgs = list(base)
            for attempt in (1, 2):
                try:
                    res = await provider.chat(msgs, json_mode=True, temperature=temperature, max_tokens=max_tokens)
                except ProviderError as exc:
                    await _mark_failed(row, exc)
                    self._log(
                        agent=agent,
                        task=task,
                        mode=mode,
                        provider=row.code,
                        ok=False,
                        run_id=run_id,
                        session_id=session_id,
                        input_summary=summary,
                        error=str(exc),
                    )
                    log.warning("llm provider failed", extra={"extra": {"provider": row.code, "err": str(exc)}})
                    break  # next provider
                try:
                    value = schema.model_validate(_extract_json(res.text))
                    if validate is not None:
                        maybe = validate(value)
                        if maybe is not None:
                            await maybe
                except (ValueError, ValidationError) as exc:
                    err = str(exc)[:800]
                    self._log(
                        agent=agent,
                        task=task,
                        mode=mode,
                        provider=row.code,
                        ok=False,
                        run_id=run_id,
                        session_id=session_id,
                        input_summary=summary,
                        output_summary=res.text,
                        tokens_in=res.tokens_in,
                        tokens_out=res.tokens_out,
                        duration_ms=res.duration_ms,
                        error=f"invalid output (attempt {attempt}): {err}",
                    )
                    if attempt == 1:
                        msgs = [
                            *base,
                            {"role": "assistant", "content": res.text},
                            {
                                "role": "user",
                                "content": "Ответ не прошёл проверку: "
                                + err
                                + "\nИсправь и верни только корректный JSON.",
                            },
                        ]
                        continue
                    break
                self._log(
                    agent=agent,
                    task=task,
                    mode=mode,
                    provider=row.code,
                    ok=True,
                    run_id=run_id,
                    session_id=session_id,
                    input_summary=summary,
                    output_summary=res.text,
                    tokens_in=res.tokens_in,
                    tokens_out=res.tokens_out,
                    duration_ms=res.duration_ms,
                )
                return LLMResult(value=value, mode=row.mode, provider=row.code)
        self._log(
            agent=agent,
            task=task,
            mode="template",
            provider="template",
            ok=True,
            run_id=run_id,
            session_id=session_id,
            input_summary=summary,
            output_summary="template fallback",
        )
        return None

    async def embed(self, texts: list[str]) -> EmbedResult:
        dim = get_settings().embedding_dim
        mode = await self.mode()
        for row, provider in await self._providers(CHAIN.get(mode, [])):
            if not row.embeddings_model:
                continue
            try:
                vecs = await provider.embed(texts)
                return EmbedResult([fit_dim(v, dim) for v in vecs], row.code)
            except ProviderError as exc:
                await _mark_failed(row, exc)
        return EmbedResult([hash_embedding(t, dim) for t in texts], "hash")
