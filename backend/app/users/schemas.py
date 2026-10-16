import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

RoleCode = Literal["student", "teacher", "methodist", "admin", "sysadmin"]


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    group_code: str | None
    status: str
    roles: list[str]
    last_login_at: datetime | None
    created_at: datetime


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    group_code: str | None = Field(default=None, max_length=32)
    roles: list[RoleCode] = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def _norm(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("email должен содержать @")
        return v.strip().lower()


class UserPatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    group_code: str | None = Field(default=None, max_length=32)
    status: Literal["active", "blocked"] | None = None
    reason: str | None = Field(default=None, max_length=500)


class RolesPut(BaseModel):
    roles: list[RoleCode] = Field(min_length=1)
    reason: str | None = Field(default=None, max_length=500)


class AuditOut(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    object_type: str
    object_id: str
    before: dict | None  # type: ignore[type-arg]
    after: dict | None  # type: ignore[type-arg]
    reason: str | None
    created_at: datetime
