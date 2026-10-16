import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, CreatedAt, UUIDPk


class VerificationResult(UUIDPk, CreatedAt, Base):
    __tablename__ = "verification_results"
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), unique=True)
    checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    base_score: Mapped[int]
    final_score: Mapped[int]
    status: Mapped[str] = mapped_column(String(16))  # passed|failed|manual_review
    errors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    corrected_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    corrected_score: Mapped[int | None]
    correction_reason: Mapped[str | None] = mapped_column(Text)
