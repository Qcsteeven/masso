import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SkillStatus = Literal["draft", "active", "deprecated", "archived"]


class RequiresIn(BaseModel):
    skill_id: uuid.UUID
    weight: float = Field(ge=0, le=1)


class SkillOut(BaseModel):
    id: uuid.UUID
    code: str
    domain_code: str
    name: str
    description: str
    level_max: int
    status: str
    dependents: int = 0


class EdgeOut(BaseModel):
    skill_id: uuid.UUID
    requires_skill_id: uuid.UUID
    weight: float


class TargetOut(BaseModel):
    domain_code: str
    skill_id: uuid.UUID
    required_level: int


class DomainOut(BaseModel):
    code: str
    name: str
    description: str
    skills_count: int = 0


class GraphOut(BaseModel):
    domains: list[DomainOut]
    skills: list[SkillOut]
    edges: list[EdgeOut]
    targets: list[TargetOut]
    acyclic: bool = True


class SkillCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64, pattern=r"^[A-Z0-9_.\-]+$")
    domain_code: str
    name: str = Field(min_length=2, max_length=255)
    description: str = ""
    level_max: int = Field(default=5, ge=1, le=10)
    status: SkillStatus = "draft"
    requires: list[RequiresIn] = []


class SkillPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    level_max: int | None = Field(default=None, ge=1, le=10)
    status: SkillStatus | None = None
    domain_code: str | None = None
    requires: list[RequiresIn] | None = None


class ImportIn(BaseModel):
    format: Literal["json", "csv"] = "json"
    content: str = Field(min_length=2, max_length=2_000_000)
    replace: bool = False


class TargetItem(BaseModel):
    skill_id: uuid.UUID
    required_level: int = Field(ge=0, le=10)


class TargetsPut(BaseModel):
    domain_code: str
    items: list[TargetItem]


class MySkillOut(BaseModel):
    skill_id: uuid.UUID
    code: str
    name: str
    domain_code: str
    level: int
    level_max: int
    required_level: int | None
    last_confirmed: datetime | None
    success_streak: int
    success_count: int
    fail_count: int
    outdated: bool


class DeficitOut(BaseModel):
    skill_id: uuid.UUID
    code: str
    name: str
    current_level: int
    required_level: int
    gap: int
    stale: bool
    days_since_confirmed: int | None
    dependents: int
    priority: Literal["critical", "high", "medium", "low"]


class RecommendationOut(BaseModel):
    template_id: uuid.UUID
    code: str
    title: str
    domain_code: str
    kind: str
    score: float
    covers: list[str]


class RecommendationsOut(BaseModel):
    domain: str
    deficits: list[DeficitOut]
    recommendations: list[RecommendationOut]
