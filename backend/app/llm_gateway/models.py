import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UUIDPk, utcnow


class LLMProvider(UUIDPk, Base):
    __tablename__ = "llm_providers"
    code: Mapped[str] = mapped_column(String(32), unique=True)
    mode: Mapped[str] = mapped_column(String(16))  # external|local|template
    base_url: Mapped[str] = mapped_column(String(255), default="")
    chat_model: Mapped[str] = mapped_column(String(128), default="")
    embeddings_model: Mapped[str] = mapped_column(String(128), default="")
    api_key_env: Mapped[str] = mapped_column(String(64), default="")  # name of env var, never the key itself
    priority: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|standby|disabled
    rate_limit: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    last_error: Mapped[str | None] = mapped_column(String(500))
    last_error_at: Mapped[datetime | None]


class LLMSettings(Base):
    __tablename__ = "llm_settings"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    generation_mode: Mapped[str] = mapped_column(String(16), default="external")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = mapped_column(default=utcnow)
    reason: Mapped[str | None] = mapped_column(String(500))
