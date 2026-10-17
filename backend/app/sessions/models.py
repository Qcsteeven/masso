import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, CreatedAt, UUIDPk


class LearningSession(UUIDPk, CreatedAt, Base):
    __tablename__ = "sessions"
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # created|starting|active|paused|submitted|checking|completed|failed|expired
    status: Mapped[str] = mapped_column(String(16), default="created", index=True)
    kind: Mapped[str] = mapped_column(String(16), default="container")
    sandbox_container_id: Mapped[str | None] = mapped_column(String(128))
    trace_id: Mapped[str] = mapped_column(String(32))
    started_at: Mapped[datetime | None]
    last_activity_at: Mapped[datetime | None]
    paused_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    incident_due_at: Mapped[datetime | None]
    incident_applied_at: Mapped[datetime | None]
    time_limit_min: Mapped[int] = mapped_column(default=40)
    cmd_log_offset: Mapped[int] = mapped_column(default=0)
    documents_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # document engine: current documents/answers
    error: Mapped[str | None] = mapped_column(Text)


class Hint(UUIDPk, CreatedAt, Base):
    __tablename__ = "hints"
    __table_args__ = (UniqueConstraint("session_id", "number", name="uq_hints_session_number"),)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    number: Mapped[int]
    question: Mapped[str] = mapped_column(Text, default="")
    text: Mapped[str] = mapped_column(Text)
    penalty_percent: Mapped[int] = mapped_column(default=10)
    source: Mapped[str] = mapped_column(String(16))  # llm|ladder
