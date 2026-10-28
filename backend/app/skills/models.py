import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, CreatedAt, UUIDPk


class Domain(Base):
    __tablename__ = "domains"
    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")


class Skill(UUIDPk, CreatedAt, Base):
    __tablename__ = "skills"
    code: Mapped[str] = mapped_column(String(64), unique=True)
    domain_code: Mapped[str] = mapped_column(ForeignKey("domains.code"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    # short theory in Markdown shown to students on the skill map, in the workspace and in the report (Д-40)
    theory: Mapped[str] = mapped_column(Text, default="", server_default="")
    level_max: Mapped[int] = mapped_column(default=4)
    status: Mapped[str] = mapped_column(String(16), default="active")  # draft|active|deprecated|archived
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class SkillRequires(Base):
    """REQUIRES edge: skill_id requires requires_skill_id."""

    __tablename__ = "skill_requires"
    __table_args__ = (
        CheckConstraint("weight >= 0 AND weight <= 1", name="weight_range"),
        CheckConstraint("skill_id <> requires_skill_id", name="no_self_loop"),
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    requires_skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    weight: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.00"))


class TrackTarget(Base):
    __tablename__ = "track_targets"
    domain_code: Mapped[str] = mapped_column(ForeignKey("domains.code"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    required_level: Mapped[int]


class UserSkill(Base):
    """HAS_SKILL edge with confirmation counters."""

    __tablename__ = "user_skills"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[int] = mapped_column(default=0)
    last_confirmed: Mapped[datetime | None]
    success_streak: Mapped[int] = mapped_column(default=0)
    success_count: Mapped[int] = mapped_column(default=0)
    fail_count: Mapped[int] = mapped_column(default=0)
