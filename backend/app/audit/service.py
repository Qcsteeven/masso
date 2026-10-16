"""Audit log and security events. Callers commit the surrounding transaction."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog, SecurityEvent
from app.errors import request_id_var


def record_audit(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    object_type: str,
    object_id: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    reason: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        object_type=object_type,
        object_id=object_id,
        before=before,
        after=after,
        reason=reason,
        request_id=request_id_var.get(),
    )
    db.add(entry)
    return entry


def record_security(
    db: AsyncSession,
    *,
    kind: str,
    user_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    severity: str = "warning",
    details: dict[str, Any] | None = None,
) -> SecurityEvent:
    ev = SecurityEvent(kind=kind, user_id=user_id, session_id=session_id, severity=severity, details=details or {})
    db.add(ev)
    return ev
