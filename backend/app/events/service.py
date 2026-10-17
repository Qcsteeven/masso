"""Digital footprint: environment_events with correlation ids, pushed to WebSocket subscribers."""

import csv
import io
import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events import bus
from app.events.models import EnvironmentEvent
from app.sessions.models import LearningSession

STUDENT_VISIBLE = ("status", "incident", "hint", "warning", "security", "check", "answer")
WS_TYPES = {"status", "incident", "hint", "warning", "security", "check"}


def event_out(e: EnvironmentEvent) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "session_id": str(e.session_id),
        "type": e.type,
        "severity": e.severity,
        "payload": e.payload,
        "created_at": e.created_at.isoformat(),
    }


def record_event(
    db: AsyncSession,
    s: LearningSession,
    type_: str,
    payload: dict[str, Any],
    severity: str = "info",
    *,
    push: bool = True,
    created_at: datetime | None = None,
) -> EnvironmentEvent:
    """Add an event row (caller commits) and push it to live subscribers."""
    ev = EnvironmentEvent(
        session_id=s.id,
        user_id=s.user_id,
        scenario_id=s.run_id,
        trace_id=s.trace_id,
        type=type_,
        severity=severity,
        payload=payload,
    )
    if created_at is not None:
        ev.created_at = created_at
    db.add(ev)
    if push and type_ in WS_TYPES:
        msg_type = "check_status" if type_ == "check" else type_
        bus.publish(
            s.id,
            {
                "type": msg_type,
                "severity": severity,
                "payload": payload,
                "created_at": (created_at or datetime.now().astimezone()).isoformat(),
            },
        )
    return ev


async def list_events(
    db: AsyncSession,
    session_id: uuid.UUID,
    *,
    types: list[str] | None = None,
    severity: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 1000,
) -> list[EnvironmentEvent]:
    stmt = select(EnvironmentEvent).where(EnvironmentEvent.session_id == session_id)
    if types:
        stmt = stmt.where(EnvironmentEvent.type.in_(types))
    if severity:
        order = ["info", "warning", "error", "critical"]
        if severity in order:
            stmt = stmt.where(EnvironmentEvent.severity.in_(order[order.index(severity) :]))
    if date_from:
        stmt = stmt.where(EnvironmentEvent.created_at >= date_from)
    if date_to:
        stmt = stmt.where(EnvironmentEvent.created_at <= date_to)
    return list((await db.scalars(stmt.order_by(EnvironmentEvent.created_at).limit(limit))).all())


def to_csv(events: list[EnvironmentEvent]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["created_at", "type", "severity", "session_id", "trace_id", "payload"])
    for e in events:
        w.writerow(
            [
                e.created_at.isoformat(),
                e.type,
                e.severity,
                str(e.session_id),
                e.trace_id,
                json.dumps(e.payload, ensure_ascii=False),
            ]
        )
    return buf.getvalue()
