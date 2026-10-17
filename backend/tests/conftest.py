"""Shared fixtures.

Unit tests need nothing. Tests marked `db` need PostgreSQL with pgvector: TEST_DATABASE_URL
(default postgresql+asyncpg://masso:masso@localhost:5433/masso_test). The database is created and
migrated once per run; every test starts from truncated tables plus the core seed.
"""

import os
from collections.abc import AsyncIterator
from typing import Any

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("WORKER_ENABLED", "false")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.setdefault("SEED_DEFAULT_PASSWORD", "masso-demo")
os.environ.setdefault("LLM_GENERATION_MODE", "template")
TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://masso:masso@localhost:5433/masso_test")
os.environ["DATABASE_URL"] = TEST_DB

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()


def _pg_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


async def _ensure_database() -> bool:
    base, _, name = _pg_url(TEST_DB).rpartition("/")
    try:
        conn = await asyncpg.connect(base + "/postgres", timeout=3)
    except (OSError, asyncpg.PostgresError):
        return False
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname=$1", name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()
    return True


_db_ready: bool | None = None


@pytest.fixture(scope="session")
async def migrated() -> AsyncIterator[None]:
    global _db_ready
    if _db_ready is None:
        _db_ready = await _ensure_database()
    if not _db_ready:
        pytest.skip("PostgreSQL недоступен (TEST_DATABASE_URL)")
    from alembic import command
    from alembic.config import Config

    from app.db import get_engine, reset_engine

    reset_engine()
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))

        def _upgrade(sync_conn: Any) -> None:
            cfg.attributes["connection"] = sync_conn
            command.upgrade(cfg, "head")

        await conn.run_sync(_upgrade)
    yield
    await engine.dispose()


@pytest.fixture
async def db(migrated: None) -> AsyncIterator[AsyncSession]:
    from app.db import get_engine, get_sessionmaker
    from app.models import Base
    from app.seed import seed_core

    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    async with get_engine().begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    async with get_sessionmaker()() as session:
        await seed_core(session)
        await session.commit()
        yield session


@pytest.fixture
async def client(db: AsyncSession) -> AsyncIterator[AsyncClient]:
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def login(client: AsyncClient, email: str, password: str = "masso-demo") -> dict[str, str]:  # noqa: S107
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture
async def as_admin(client: AsyncClient) -> dict[str, str]:
    return await login(client, "admin@masso.local")


@pytest.fixture
async def as_student(client: AsyncClient) -> dict[str, str]:
    return await login(client, "demonov.la@masso.local")


@pytest.fixture
async def as_teacher(client: AsyncClient) -> dict[str, str]:
    return await login(client, "teacher@masso.local")


@pytest.fixture
async def as_methodist(client: AsyncClient) -> dict[str, str]:
    return await login(client, "methodist@masso.local")


SEED = __import__("pathlib").Path(__file__).parents[1] / "seed"


@pytest.fixture
async def seeded(db: AsyncSession) -> None:
    """Competency graph + scenario templates from backend/seed."""
    import json

    from app.scenarios.seed import seed_templates
    from app.skills.service import import_graph_data

    await import_graph_data(db, json.loads((SEED / "skills.json").read_text("utf-8")), actor_id=None, replace=False)
    await seed_templates(db, SEED / "templates")
    await db.commit()
