"""Idempotent seed: `python -m app.seed` (make seed).

Creates roles, demo users, domains, sandbox profiles, LLM providers, and — when the data files exist —
the competency graph (seed/skills.json) and scenario templates (seed/templates/*.json).
"""

import asyncio
import json
import logging
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import hash_password
from app.config import get_settings
from app.db import get_sessionmaker
from app.llm_gateway.models import LLMProvider, LLMSettings
from app.sandbox.models import SandboxProfile
from app.skills.models import Domain
from app.users.models import Role, User, UserRole

log = logging.getLogger("masso.seed")
SEED_DIR = Path(__file__).resolve().parent.parent / "seed"

ROLES = [
    ("student", "Обучающийся"),
    ("teacher", "Преподаватель"),
    ("methodist", "Методист"),
    ("admin", "Администратор"),
    ("sysadmin", "Системный администратор"),
]
GROUP = "ИСИб-23-1"
USERS: list[tuple[str, str, list[str], str | None]] = [
    ("admin@masso.local", "Администратор МАССО", ["admin"], None),
    ("ops@masso.local", "Оператор стенда", ["sysadmin"], None),
    ("teacher@masso.local", "Шипицин Дмитрий Сергеевич", ["teacher"], GROUP),
    ("methodist@masso.local", "Методист кафедры", ["methodist"], None),
    ("demonov.la@masso.local", "Демонов Лев Алексеевич", ["student"], GROUP),
    ("ivanov.as@masso.local", "Иванов Артём Сергеевич", ["student"], GROUP),
    ("petrova.md@masso.local", "Петрова Мария Дмитриевна", ["student"], GROUP),
    ("kim.ea@masso.local", "Ким Елена Андреевна", ["student"], GROUP),
    ("orlova.dp@masso.local", "Орлова Дарья Павловна", ["student"], GROUP),
    ("zakharov.ni@masso.local", "Захаров Никита Игоревич", ["student"], GROUP),
]
DOMAINS = [
    ("devops", "DevOps и администрирование", "Восстановление и сопровождение веб-сервисов"),
    ("security", "Информационная безопасность", "Анализ инцидентов и ограничение прав"),
    ("legal", "Юриспруденция", "Документные кейсы по договорам"),
    ("audit", "Экономика и аудит", "Сверка первичных документов"),
]
PROFILES = [
    ("small", Decimal("1.00"), 1024, 128, 512),
    ("medium", Decimal("2.00"), 2048, 256, 1024),
    ("document", Decimal("0.00"), 0, 0, 0),
]


async def _get_or_create(
    db: AsyncSession, model: type[Any], defaults: dict[str, Any] | None = None, **keys: Any
) -> tuple[Any, bool]:
    row = await db.scalar(select(model).filter_by(**keys))
    if row is not None:
        return row, False
    row = model(**keys, **(defaults or {}))
    db.add(row)
    await db.flush()
    return row, True


async def seed_core(db: AsyncSession) -> None:
    settings = get_settings()
    roles: dict[str, Role] = {}
    for code, name in ROLES:
        roles[code], _ = await _get_or_create(db, Role, {"name": name, "permissions": {}}, code=code)
    pw = hash_password(settings.seed_default_password)
    for email, full_name, rcodes, group in USERS:
        if await db.scalar(select(User.id).where(User.email == email)) is None:
            db.add(
                User(
                    email=email,
                    full_name=full_name,
                    password_hash=pw,
                    group_code=group,
                    status="active",
                    roles=[UserRole(role_id=roles[c].id, role=roles[c]) for c in rcodes],
                )
            )
    await db.flush()
    for code, name, desc in DOMAINS:
        await _get_or_create(db, Domain, {"name": name, "description": desc}, code=code)
    for code, cpu, mem, pids, storage in PROFILES:
        await _get_or_create(
            db,
            SandboxProfile,
            {
                "image": settings.sandbox_image if code != "document" else "",
                "cpu": cpu,
                "mem_mb": mem,
                "pids_limit": pids,
                "storage_mb": storage,
                "network_policy": "deny_all",
            },
            code=code,
        )
    for code, conn, extra in (
        (
            "external",
            {
                "base_url": settings.llm_external_base_url,
                "chat_model": settings.llm_external_chat_model,
                "embeddings_model": settings.llm_external_embed_model,
            },
            {"mode": "external", "api_key_env": "LLM_EXTERNAL_API_KEY", "priority": 1, "status": "active"},
        ),
        (
            "local",
            {
                "base_url": settings.llm_local_base_url,
                "chat_model": settings.llm_local_chat_model,
                "embeddings_model": settings.llm_local_embed_model,
            },
            {"mode": "local", "api_key_env": "LLM_LOCAL_API_KEY", "priority": 2, "status": "standby"},
        ),
    ):
        provider, created = await _get_or_create(db, LLMProvider, {**conn, **extra}, code=code)
        if not created:
            # LLM_* set in .env after the first seed: the next seed applies them (empty values keep the row)
            for k, v in conn.items():
                if v:
                    setattr(provider, k, v)
    await _get_or_create(db, LLMProvider, {"mode": "template", "priority": 3, "status": "active"}, code="template")
    await _get_or_create(db, LLMSettings, {"generation_mode": settings.llm_generation_mode}, id=1)


async def seed_all() -> None:
    async with get_sessionmaker()() as db:
        await seed_core(db)
        await db.commit()
        skills_file = SEED_DIR / "skills.json"
        if skills_file.exists():
            from app.skills.service import import_graph_data

            await import_graph_data(db, json.loads(skills_file.read_text("utf-8")), actor_id=None, replace=False)
            await db.commit()
        tdir = SEED_DIR / "templates"
        if tdir.exists():
            from app.scenarios.seed import seed_templates

            await seed_templates(db, tdir)
            await db.commit()
    log.info("seed complete")


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    asyncio.run(seed_all())
