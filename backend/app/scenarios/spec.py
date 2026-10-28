"""Scenario specification (spec §4, ТЗ 4.1.6). One Pydantic type for templates and generated runs.

Hidden parts (faults, checks, answer keys, fix scripts) never leave the server for a student: use
`to_public()` which builds `ScenarioPublic`.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, TypeAdapter, model_validator

CheckType = Literal[
    "docker_inspect", "docker_exec", "http_health", "file_diff", "rule_match", "semantic_similarity", "numeric_match"
]


class TargetSkill(BaseModel):
    skill: str  # skill code
    weight: float = Field(gt=0, le=1)


class Legend(BaseModel):
    template: str = Field(min_length=10)  # str.format-style placeholders from params
    brief: str = ""  # instructions for the LLM that writes the legend
    llm_generated: bool = True


class Fault(BaseModel):
    apply: str
    fix: str
    description: str = ""


class FaultCatalog(BaseModel):
    initial: list[str] = Field(min_length=1)  # one of them is applied at session start
    catalog: dict[str, Fault]

    @model_validator(mode="after")
    def _known(self) -> "FaultCatalog":
        missing = [f for f in self.initial if f not in self.catalog]
        if missing:
            raise ValueError(f"initial faults not in catalog: {missing}")
        return self


class DocMutation(BaseModel):
    doc_id: str
    find: str
    replace: str


class Incident(BaseModel):
    id: str
    after_min: tuple[float, float] = (2.0, 5.0)
    message: str
    fault: str | None = None  # container engine
    mutation: DocMutation | None = None  # document engine
    adds_answer: dict[str, Any] | None = None  # document engine: new expected finding


class Check(BaseModel):
    id: str
    title: str  # student-facing criterion
    type: CheckType
    weight: float = Field(gt=0)
    critical: bool = False
    params: dict[str, Any] = {}


class Hints(BaseModel):
    policy: Literal["none", "limited_3", "teacher_allowed"] = "limited_3"
    ladder: list[str] = Field(min_length=3, max_length=3)


class Success(BaseModel):
    threshold: int = Field(default=75, ge=1, le=100)


class Document(BaseModel):
    id: str
    title: str
    markdown: str


class AnswerItem(BaseModel):
    """Expected finding (legal) or expected value (audit). Hidden."""

    id: str
    section: str = ""
    defect_type: str = ""
    quote: str = ""  # must literally appear in the document (dynamic validation)
    expected_fix: str = ""
    value: float | None = None
    field: str = ""


class _Base(BaseModel):
    code: str
    version: int = 1
    domain: str
    title: str
    target_skills: list[TargetSkill] = Field(min_length=1)
    difficulty: int = Field(default=2, ge=1, le=5)
    time_limit_min: int = Field(default=40, ge=5, le=240)
    legend: Legend
    params: dict[str, list[Any]] = {}
    incidents: list[Incident] = []
    # pool mode: each variant gets a random number of incidents in [lo, hi] from `incidents` (None = all, in order)
    incidents_pick: tuple[int, int] | None = None
    checks: list[Check] = Field(min_length=1)
    hints: Hints
    success: Success = Success()
    constraints: str = ""
    log_retention_days: int = 180
    variants: list[dict[str, Any]] = []  # pre-generated material for template mode
    # filled for generated runs:
    legend_text: str | None = None
    chosen: dict[str, Any] = {}

    @model_validator(mode="after")
    def _checks(self) -> "_Base":
        ids = [c.id for c in self.checks]
        if len(ids) != len(set(ids)):
            raise ValueError("check ids must be unique")
        if not any(c.critical for c in self.checks):
            raise ValueError("at least one critical check is required")
        return self


def _check_pick(pick: tuple[int, int] | None, pool: int) -> None:
    if pick is not None and not 1 <= pick[0] <= pick[1] <= pool:
        raise ValueError(f"incidents_pick must satisfy 1 <= lo <= hi <= {pool} (number of incidents)")


class ContainerSpec(_Base):
    kind: Literal["container"] = "container"
    profile: str = "small"
    network_policy: Literal["deny_all"] = "deny_all"
    faults: FaultCatalog

    @model_validator(mode="after")
    def _incident_faults(self) -> "ContainerSpec":
        _check_pick(self.incidents_pick, len(self.incidents))
        for inc in self.incidents:
            if inc.fault is None or inc.fault not in self.faults.catalog:
                raise ValueError(f"incident {inc.id}: fault must reference the catalog")
        return self


class DocumentSpec(_Base):
    kind: Literal["document"] = "document"
    profile: str = "document"
    generator: Literal["llm", "code"] = "code"
    builder: str = ""  # name in scenarios.generators.GENERATORS
    documents: list[Document] = []
    defect_catalog: dict[str, str] = {}  # defect_type -> title shown in the answer form
    answer_key: list[AnswerItem] = []
    answer_form: dict[str, Any] = {}  # JSON-schema-like description of the student form


ScenarioSpec = Annotated[ContainerSpec | DocumentSpec, Field(discriminator="kind")]


_ADAPTER: TypeAdapter[ContainerSpec | DocumentSpec] = TypeAdapter(ScenarioSpec)


def parse_spec(data: dict[str, Any]) -> ContainerSpec | DocumentSpec:
    return _ADAPTER.validate_python(data)


def spec_json_schema() -> dict[str, Any]:
    return _ADAPTER.json_schema()


class DocumentPublic(BaseModel):
    id: str
    title: str
    markdown: str


class ScenarioPublic(BaseModel):
    """What a student may see. No faults, checks params, answer keys, fix scripts or prompts."""

    run_id: str
    code: str
    domain: str
    kind: str
    title: str
    legend: str
    difficulty: int
    time_limit_min: int
    criteria: list[str]
    constraints: str
    hints_max: int
    skills: list[str] = []  # target skill codes: the student's theory for the scenario
    documents: list[DocumentPublic] = []
    defect_types: dict[str, str] = {}
    answer_form: dict[str, Any] = {}


def to_public(run_id: str, spec: ContainerSpec | DocumentSpec) -> ScenarioPublic:
    docs: list[DocumentPublic] = []
    defect_types: dict[str, str] = {}
    form: dict[str, Any] = {}
    if isinstance(spec, DocumentSpec):
        docs = [DocumentPublic(id=d.id, title=d.title, markdown=d.markdown) for d in spec.documents]
        defect_types, form = spec.defect_catalog, spec.answer_form
    return ScenarioPublic(
        run_id=run_id,
        code=spec.code,
        domain=spec.domain,
        kind=spec.kind,
        title=spec.title,
        legend=spec.legend_text or spec.legend.template,
        difficulty=spec.difficulty,
        time_limit_min=spec.time_limit_min,
        criteria=[c.title for c in spec.checks],
        constraints=spec.constraints,
        hints_max=0 if spec.hints.policy == "none" else 3,
        skills=[t.skill for t in spec.target_skills],
        documents=docs,
        defect_types=defect_types,
        answer_form=form,
    )
