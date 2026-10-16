import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, CreatedAt, UUIDPk, utcnow


class Role(UUIDPk, Base):
    __tablename__ = "roles"
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    permissions: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(default=utcnow)
    role: Mapped[Role] = relationship(lazy="joined")


class User(UUIDPk, CreatedAt, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    group_code: Mapped[str | None] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|blocked|invited
    last_login_at: Mapped[datetime | None]
    roles: Mapped[list[UserRole]] = relationship(lazy="selectin", cascade="all, delete-orphan")

    @property
    def role_codes(self) -> list[str]:
        return sorted(r.role.code for r in self.roles)
