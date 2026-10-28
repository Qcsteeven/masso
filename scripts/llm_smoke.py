"""Manual check of the real LLM providers (phase 3).

Usage (from repo root, with .env filled in):
    cd backend && uv run python ../scripts/llm_smoke.py [external|local]
Providers reachable only inside the compose network (gpt2giga, ollama) — run it in the backend container:
    docker compose exec -T backend python - external < scripts/llm_smoke.py
Prints the generated legend, the provider that answered, tokens and the embedding source.
"""

import asyncio
import sys

sys.path.insert(0, ".")

from pydantic import BaseModel  # noqa: E402
from sqlalchemy import select  # noqa: E402

import app.models  # noqa: E402, F401  (registers every table: llm_settings references users)
from app.db import get_sessionmaker  # noqa: E402
from app.audit.models import AgentLog  # noqa: E402
from app.llm_gateway.gateway import LLMGateway  # noqa: E402
from app.llm_gateway.models import LLMSettings  # noqa: E402


class Legend(BaseModel):
    title: str
    legend: str


async def main(mode: str) -> None:
    async with get_sessionmaker()() as db:
        s = await db.get(LLMSettings, 1)
        if s is not None:
            s.generation_mode = mode
        gw = LLMGateway(db)
        res = await gw.complete_json("smoke", [{"role": "user", "content":
            "Придумай короткую (3 предложения) легенду учебного инцидента: интернет-магазин отдаёт 502, "
            "приложение не подключается к базе данных. Верни title и legend на русском."}], Legend, agent="smoke")
        emb = await gw.embed(["Сервис интернет-магазина недоступен"])
        calls = [
            f"Вызов {c.provider}: ok={c.ok}, токены {c.tokens_in} → {c.tokens_out}, {c.duration_ms} мс {c.error or ''}"
            for c in (await db.scalars(select(AgentLog).where(AgentLog.agent == "smoke"))).all()
        ]
        await db.rollback()  # do not keep the mode change or logs
    if res is None:
        print("Ответа нет: все провайдеры недоступны (см. agent_logs/ошибки выше).")
    else:
        print(f"Провайдер: {res.provider} ({res.mode})\n{res.value.title}\n{res.value.legend}")
    print(*calls, sep="\n")
    print(f"Эмбеддинги: {emb.source}, размерность {len(emb.vectors[0])}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "external"))
