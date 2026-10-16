import uuid
from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, CreatedAt, UUIDPk

EVENT_TYPES = ("command", "file_change", "answer", "incident", "hint", "check", "error", "security", "status")
SEVERITIES = ("info", "warning", "error", "critical")


class EnvironmentEvent(UUIDPk, CreatedAt, Base):
    __tablename__ = "environment_events"
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id", ondelete="CASCADE"))
    trace_id: Mapped[str] = mapped_column(String(32))
    type: Mapped[str] = mapped_column(String(16), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="info")
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
