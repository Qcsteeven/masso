import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TemplateBrief(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    domain_code: str
    kind: str
    status: str
    version: int
    difficulty: int
    time_limit_min: int
    validated: bool = False
    published_at: datetime | None = None


class TemplateOut(TemplateBrief):
    spec: dict[str, Any]
    validation_report: dict[str, Any] | None
    created_at: datetime


class TemplateIn(BaseModel):
    spec: dict[str, Any]


class GenerateIn(BaseModel):
    template_id: uuid.UUID


class AssignmentIn(BaseModel):
    template_id: uuid.UUID
    group_code: str | None = Field(default=None, max_length=32)
    user_id: uuid.UUID | None = None
    due_at: datetime | None = None


class AssignmentOut(BaseModel):
    id: uuid.UUID
    template: TemplateBrief
    group_code: str | None
    user_id: uuid.UUID | None
    due_at: datetime | None
    created_at: datetime
    last_session_id: uuid.UUID | None = None
    last_session_status: str | None = None
    last_score: int | None = None


class RunOut(BaseModel):
    run_id: uuid.UUID
    status: str
    generation_mode: str
    duration_ms: int
    validation_report: dict[str, Any] | None = None
