"""In-process liveness markers (worker heartbeat)."""

from datetime import UTC, datetime
from typing import Any

_state: dict[str, Any] = {"last_tick": None, "ticks": 0, "last_error": None}


def worker_tick(error: str | None = None) -> None:
    _state["last_tick"] = datetime.now(UTC)
    _state["ticks"] += 1
    _state["last_error"] = error


def worker_state() -> dict[str, Any]:
    last = _state["last_tick"]
    age = (datetime.now(UTC) - last).total_seconds() if last else None
    return {
        "last_tick": last.isoformat() if last else None,
        "age_sec": age,
        "ticks": _state["ticks"],
        "last_error": _state["last_error"],
    }
