"""FastAPI application factory."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text

from app import health
from app.auth.router import router as auth_router
from app.config import get_settings
from app.db import get_engine
from app.errors import RequestIdMiddleware, install_error_handlers, ok
from app.logging_setup import setup_logging
from app.users.router import router as users_router

log = logging.getLogger("masso")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    task: asyncio.Task[None] | None = None
    if settings.worker_enabled:
        from app.worker import run_forever

        task = asyncio.create_task(run_forever(), name="masso-worker")
    yield
    if task is not None:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    await get_engine().dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging()
    app = FastAPI(
        title="МАССО API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(RequestIdMiddleware)
    install_error_handlers(app)

    @app.get("/api/health", tags=["service"])
    async def api_health() -> dict[str, Any]:
        db_ok = True
        try:
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            db_ok = False
        return ok(
            {
                "service": "masso",
                "db": "ok" if db_ok else "unavailable",
                "worker": health.worker_state(),
                "env": settings.app_env,
            }
        )

    for router in (auth_router, users_router, *_optional_routers()):
        app.include_router(router)

    Instrumentator(excluded_handlers=["/metrics", "/api/health"]).instrument(app).expose(
        app, endpoint="/metrics", include_in_schema=False
    )
    return app


def _optional_routers() -> list[Any]:
    """Routers of later phases; imported lazily so the app starts while modules are being built."""
    routers: list[Any] = []
    import importlib

    for mod in (
        "app.skills.router",
        "app.llm_gateway.router",
        "app.scenarios.router",
        "app.sessions.router",
        "app.events.router",
        "app.verification.router",
        "app.reports.router",
        "app.admin.router",
    ):
        try:
            m = importlib.import_module(mod)
        except ModuleNotFoundError as exc:
            if exc.name == mod:
                continue
            raise
        routers.extend(getattr(m, "routers", [m.router]))
    return routers


app = create_app()
