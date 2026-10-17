"""In-process pub/sub for session events (single backend process in the first queue)."""

import asyncio
import uuid
from collections import defaultdict
from typing import Any

_subs: dict[uuid.UUID, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)


def subscribe(session_id: uuid.UUID) -> asyncio.Queue[dict[str, Any]]:
    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
    _subs[session_id].add(q)
    return q


def unsubscribe(session_id: uuid.UUID, q: asyncio.Queue[dict[str, Any]]) -> None:
    _subs[session_id].discard(q)
    if not _subs[session_id]:
        _subs.pop(session_id, None)


def publish(session_id: uuid.UUID, message: dict[str, Any]) -> None:
    for q in list(_subs.get(session_id, ())):
        if q.full():
            try:
                q.get_nowait()
            except asyncio.QueueEmpty:
                pass
        q.put_nowait(message)


def subscribers(session_id: uuid.UUID) -> int:
    return len(_subs.get(session_id, ()))
