import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, CreatedAt, UUIDPk


class AuditLog(UUIDPk, CreatedAt, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[str] = mapped_column(String(64))
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    reason: Mapped[str | None] = mapped_column(Text)
    request_id: Mapped[str | None] = mapped_column(String(64))


class SecurityEvent(UUIDPk, CreatedAt, Base):
    __tablename__ = "security_events"
    __table_args__ = (Index("ix_security_events_kind_created", "kind", "created_at"),)  # login throttling, journal
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sessions.id", ondelete="SET NULL"), index=True)
    kind: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16), default="warning")
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class AgentLog(UUIDPk, CreatedAt, Base):
    __tablename__ = "agent_logs"
    agent: Mapped[str] = mapped_column(String(32))
    task: Mapped[str] = mapped_column(String(64), default="")
    run_id: Mapped[uuid.UUID | None]
    session_id: Mapped[uuid.UUID | None]
    mode: Mapped[str] = mapped_column(String(16))
    provider: Mapped[str] = mapped_column(String(32), default="")
    input_summary: Mapped[str] = mapped_column(Text, default="")
    output_summary: Mapped[str] = mapped_column(Text, default="")
    tokens_in: Mapped[int] = mapped_column(default=0)
    tokens_out: Mapped[int] = mapped_column(default=0)
    duration_ms: Mapped[int] = mapped_column(default=0)
    ok: Mapped[bool] = mapped_column(default=True)
    error: Mapped[str | None] = mapped_column(Text)
