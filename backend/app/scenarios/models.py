import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, CreatedAt, UUIDPk

EMBED_DIM = 1024


class ScenarioTemplate(UUIDPk, CreatedAt, Base):
    __tablename__ = "scenario_templates"
    code: Mapped[str] = mapped_column(String(64), index=True)
    domain_code: Mapped[str] = mapped_column(ForeignKey("domains.code"))
    kind: Mapped[str] = mapped_column(String(16))  # container|document
    title: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft|validating|published|archived|rejected
    spec: Mapped[dict[str, Any]] = mapped_column(JSONB)
    validation_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    published_at: Mapped[datetime | None]


class TemplateSkill(Base):
    """TARGETS edge between template and skill."""

    __tablename__ = "template_skills"
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scenario_templates.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    weight: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.00"))


class ScenarioRun(UUIDPk, CreatedAt, Base):
    __tablename__ = "scenario_runs"
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_templates.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    generated_spec: Mapped[dict[str, Any]] = mapped_column(JSONB)
    generation_mode: Mapped[str] = mapped_column(String(16))  # external|local|template
    legend_embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBED_DIM))
    validation_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # published|rejected


class Assignment(UUIDPk, CreatedAt, Base):
    __tablename__ = "assignments"
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_templates.id", ondelete="CASCADE"))
    group_code: Mapped[str | None] = mapped_column(String(32), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    due_at: Mapped[datetime | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class AcceptedSolution(UUIDPk, CreatedAt, Base):
    """Alternative solution marked by a teacher (knowledge base is second queue)."""

    __tablename__ = "accepted_solutions"
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_templates.id", ondelete="CASCADE"))
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    trace: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBED_DIM))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
