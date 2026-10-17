"""Background worker: one asyncio loop, all state in PostgreSQL (spec §1, §6).

Jobs are registered by modules (incidents, idle control, cleanup, retention) via `register`.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from app import health
from app.config import get_settings

log = logging.getLogger("masso.worker")

Job = Callable[[datetime], Awaitable[None]]
_jobs: list[tuple[str, Job]] = []


def register(name: str, job: Job) -> None:
    if all(n != name for n, _ in _jobs):
        _jobs.append((name, job))


def _load_jobs() -> None:
    import importlib

    for mod in ("app.sessions.jobs", "app.assessment_agent.jobs"):
        try:
            importlib.import_module(mod)
        except ModuleNotFoundError as exc:
            if exc.name != mod:
                raise


async def tick(now: datetime | None = None) -> list[str]:
    """Run every job once. Errors in one job do not stop the others. Returns failed job names."""
    now = now or datetime.now(UTC)
    failed: list[str] = []
    for name, job in list(_jobs):
        try:
            await job(now)
        except Exception:
            log.exception("worker job failed: %s", name)
            failed.append(name)
    health.worker_tick(",".join(failed) or None)
    return failed


async def run_forever() -> None:
    _load_jobs()
    interval = get_settings().worker_tick_sec
    log.info("worker started", extra={"extra": {"jobs": [n for n, _ in _jobs]}})
    while True:
        await tick()
        await asyncio.sleep(interval)
