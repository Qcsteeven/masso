"""Scenario templates, generation through ScenarioAgent, runs and assignments."""

import time
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from pydantic import ValidationError
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import record_audit
from app.deps import CurrentUser
from app.errors import AppError, ErrorCode
from app.llm_gateway.gateway import LLMGateway
from app.scenario_agent.graph import ScenarioAgent
from app.scenarios.models import Assignment, ScenarioRun, ScenarioTemplate, TemplateSkill
from app.scenarios.schemas import AssignmentIn, AssignmentOut, RunOut, TemplateBrief, TemplateOut
from app.scenarios.spec import ContainerSpec, DocumentSpec, ScenarioPublic, parse_spec, to_public
from app.skills.models import Skill


def _validated(t: ScenarioTemplate) -> bool:
    r = t.validation_report or {}
    return r.get("status") == "published" and r.get("version") == t.version


def brief(t: ScenarioTemplate) -> TemplateBrief:
    spec = t.spec
    return TemplateBrief(
        id=t.id,
        code=t.code,
        title=t.title,
        domain_code=t.domain_code,
        kind=t.kind,
        status=t.status,
        version=t.version,
        difficulty=int(spec.get("difficulty", 2)),
        time_limit_min=int(spec.get("time_limit_min", 40)),
        validated=_validated(t),
        published_at=t.published_at,
    )


def full(t: ScenarioTemplate) -> TemplateOut:
    return TemplateOut(
        **brief(t).model_dump(), spec=t.spec, validation_report=t.validation_report, created_at=t.created_at
    )


def _parse(spec: dict[str, Any]) -> ContainerSpec | DocumentSpec:
    try:
        return parse_spec(spec)
    except ValidationError as exc:
        fields = [{"loc": [str(x) for x in e["loc"]], "msg": e["msg"]} for e in exc.errors()[:20]]
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Спецификация сценария не соответствует схеме.", {"fields": fields}
        ) from None


async def get_template(db: AsyncSession, template_id: uuid.UUID) -> ScenarioTemplate:
    t = await db.get(ScenarioTemplate, template_id)
    if t is None:
        raise AppError(ErrorCode.NOT_FOUND, "Шаблон сценария не найден.")
    return t


async def list_templates(db: AsyncSession, user: CurrentUser, domain: str | None) -> list[TemplateBrief]:
    stmt = select(ScenarioTemplate).order_by(ScenarioTemplate.domain_code, ScenarioTemplate.title)
    if domain:
        stmt = stmt.where(ScenarioTemplate.domain_code == domain)
    if not user.has("teacher", "methodist", "admin"):
        stmt = stmt.where(ScenarioTemplate.status == "published")
    return [brief(t) for t in (await db.scalars(stmt)).all()]


async def _sync_skills(db: AsyncSession, t: ScenarioTemplate, spec: ContainerSpec | DocumentSpec) -> None:
    codes = {ts.skill: ts.weight for ts in spec.target_skills}
    skills = {s.code: s for s in (await db.scalars(select(Skill).where(Skill.code.in_(codes)))).all()}
    missing = sorted(set(codes) - set(skills))
    if missing:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Неизвестные навыки в target_skills: {', '.join(missing)}.")
    await db.execute(delete(TemplateSkill).where(TemplateSkill.template_id == t.id))
    for code, w in codes.items():
        db.add(TemplateSkill(template_id=t.id, skill_id=skills[code].id, weight=Decimal(str(round(w, 2)))))


async def create_template(db: AsyncSession, actor: CurrentUser, raw: dict[str, Any]) -> TemplateOut:
    spec = _parse(raw)
    if await db.scalar(select(ScenarioTemplate.id).where(ScenarioTemplate.code == spec.code)):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Шаблон с таким кодом уже существует.")
    t = ScenarioTemplate(
        code=spec.code,
        domain_code=spec.domain,
        kind=spec.kind,
        title=spec.title,
        version=spec.version,
        status="draft",
        spec=spec.model_dump(mode="json"),
        created_by=actor.id,
    )
    db.add(t)
    await db.flush()
    await _sync_skills(db, t, spec)
    record_audit(
        db,
        actor_id=actor.id,
        action="template.create",
        object_type="scenario_template",
        object_id=str(t.id),
        after={"code": t.code, "version": t.version},
    )
    await db.commit()
    return full(t)


async def update_template(
    db: AsyncSession, actor: CurrentUser, template_id: uuid.UUID, raw: dict[str, Any]
) -> TemplateOut:
    t = await get_template(db, template_id)
    spec = _parse(raw)
    if spec.code != t.code:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Код шаблона менять нельзя.")
    before = {"version": t.version, "status": t.status}
    if t.status == "published":
        t.version += 1
    spec.version = t.version
    t.spec, t.title, t.kind, t.domain_code = spec.model_dump(mode="json"), spec.title, spec.kind, spec.domain
    t.status = "draft"
    await _sync_skills(db, t, spec)
    record_audit(
        db,
        actor_id=actor.id,
        action="template.update",
        object_type="scenario_template",
        object_id=str(t.id),
        before=before,
        after={"version": t.version, "status": t.status},
    )
    await db.commit()
    return full(t)


def _agent(db: AsyncSession) -> ScenarioAgent:
    from app.sandbox.manager import get_sandbox

    return ScenarioAgent(db, LLMGateway(db), get_sandbox())


async def validate_template(db: AsyncSession, actor: CurrentUser, template_id: uuid.UUID) -> TemplateOut:
    t = await get_template(db, template_id)
    t0 = time.perf_counter()
    state = await _agent(db).run(template_id=t.id, template_code=t.code, base=t.spec, user_id=None)
    t.validation_report = {
        "status": state.get("status"),
        "version": t.version,
        "steps": state.get("steps", []),
        "errors": state.get("errors", []),
        "generation_mode": state.get("mode", "template"),
        "duration_ms": int((time.perf_counter() - t0) * 1000),
        "validated_at": datetime.now(UTC).isoformat(),
    }
    record_audit(
        db,
        actor_id=actor.id,
        action="template.validate",
        object_type="scenario_template",
        object_id=str(t.id),
        after={"status": state.get("status"), "version": t.version},
    )
    await db.commit()
    return full(t)


async def publish_template(db: AsyncSession, actor: CurrentUser, template_id: uuid.UUID) -> TemplateOut:
    t = await get_template(db, template_id)
    if not _validated(t):
        raise AppError(
            ErrorCode.SCENARIO_NOT_VALID, "Шаблон можно опубликовать только после успешной валидации текущей версии."
        )
    before = t.status
    t.status, t.published_at = "published", datetime.now(UTC)
    record_audit(
        db,
        actor_id=actor.id,
        action="template.publish",
        object_type="scenario_template",
        object_id=str(t.id),
        before={"status": before},
        after={"status": "published", "version": t.version},
    )
    await db.commit()
    return full(t)


async def archive_template(db: AsyncSession, actor: CurrentUser, template_id: uuid.UUID) -> TemplateOut:
    t = await get_template(db, template_id)
    before = t.status
    t.status = "archived"
    record_audit(
        db,
        actor_id=actor.id,
        action="template.archive",
        object_type="scenario_template",
        object_id=str(t.id),
        before={"status": before},
        after={"status": "archived"},
    )
    await db.commit()
    return full(t)


async def generate(db: AsyncSession, user: CurrentUser, template_id: uuid.UUID, seed: int | None = None) -> RunOut:
    t = await get_template(db, template_id)
    if t.status != "published":
        raise AppError(ErrorCode.SCENARIO_NOT_VALID, "Сценарий ещё не опубликован методистом.")
    t0 = time.perf_counter()
    state = await _agent(db).run(template_id=t.id, template_code=t.code, base=t.spec, user_id=user.id, seed=seed)
    status = state.get("status") or "rejected"
    report = {
        "status": status,
        "steps": state.get("steps", []),
        "errors": state.get("errors", []),
        "similarity": state.get("similarity"),
    }
    run = ScenarioRun(
        template_id=t.id,
        user_id=user.id,
        generated_spec=state.get("spec", t.spec),
        generation_mode=state.get("mode", "template"),
        legend_embedding=state.get("embedding"),
        validation_report=report,
        status=status,
    )
    db.add(run)
    await db.commit()
    duration = int((time.perf_counter() - t0) * 1000)
    if status != "published":
        raise AppError(
            ErrorCode.SCENARIO_NOT_VALID,
            "Не удалось подготовить корректный вариант сценария. Попробуйте ещё раз или выберите другой.",
            {"run_id": str(run.id)},
        )
    return RunOut(run_id=run.id, status=status, generation_mode=run.generation_mode, duration_ms=duration)


async def get_run(db: AsyncSession, run_id: uuid.UUID) -> ScenarioRun:
    run = await db.get(ScenarioRun, run_id)
    if run is None:
        raise AppError(ErrorCode.NOT_FOUND, "Сценарий не найден.")
    return run


async def run_public(db: AsyncSession, user: CurrentUser, run_id: uuid.UUID) -> ScenarioPublic | dict[str, Any]:
    run = await get_run(db, run_id)
    spec = parse_spec(run.generated_spec)
    if user.has("methodist", "admin", "teacher"):
        return {
            "run_id": str(run.id),
            "status": run.status,
            "generation_mode": run.generation_mode,
            "spec": run.generated_spec,
            "validation_report": run.validation_report,
        }
    if run.user_id != user.id:
        raise AppError(ErrorCode.AUTH_FORBIDDEN, "Это сценарий другого обучающегося.")
    return to_public(str(run.id), spec)


async def create_assignment(db: AsyncSession, actor: CurrentUser, body: AssignmentIn) -> AssignmentOut:
    t = await get_template(db, body.template_id)
    if t.status != "published":
        raise AppError(ErrorCode.SCENARIO_NOT_VALID, "Назначить можно только опубликованный сценарий.")
    if not body.group_code and not body.user_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Укажите группу или обучающегося.")
    a = Assignment(
        template_id=t.id, group_code=body.group_code, user_id=body.user_id, due_at=body.due_at, created_by=actor.id
    )
    db.add(a)
    record_audit(
        db,
        actor_id=actor.id,
        action="assignment.create",
        object_type="assignment",
        object_id=str(t.id),
        after={"group_code": body.group_code, "user_id": str(body.user_id) if body.user_id else None},
    )
    await db.commit()
    return AssignmentOut(
        id=a.id, template=brief(t), group_code=a.group_code, user_id=a.user_id, due_at=a.due_at, created_at=a.created_at
    )


async def my_assignments(db: AsyncSession, user: CurrentUser) -> list[AssignmentOut]:
    conds = [Assignment.user_id == user.id]
    if user.group_code:
        conds.append(Assignment.group_code == user.group_code)
    rows = (
        await db.execute(
            select(Assignment, ScenarioTemplate)
            .join(ScenarioTemplate)
            .where(or_(*conds), ScenarioTemplate.status == "published")
            .order_by(Assignment.due_at.nulls_last(), Assignment.created_at)
        )
    ).all()
    from app.sessions.models import LearningSession
    from app.verification.models import VerificationResult

    out: list[AssignmentOut] = []
    seen: set[uuid.UUID] = set()
    for a, t in rows:
        if t.id in seen:
            continue
        seen.add(t.id)
        last = (
            await db.execute(
                select(LearningSession, VerificationResult)
                .join(ScenarioRun, ScenarioRun.id == LearningSession.run_id)
                .outerjoin(VerificationResult, VerificationResult.session_id == LearningSession.id)
                .where(ScenarioRun.template_id == t.id, LearningSession.user_id == user.id)
                .order_by(LearningSession.created_at.desc())
                .limit(1)
            )
        ).first()
        sess, ver = (last[0], last[1]) if last else (None, None)
        score = (ver.corrected_score if ver and ver.corrected_score is not None else ver.final_score) if ver else None
        out.append(
            AssignmentOut(
                id=a.id,
                template=brief(t),
                group_code=a.group_code,
                user_id=a.user_id,
                due_at=a.due_at,
                created_at=a.created_at,
                last_session_id=sess.id if sess else None,
                last_session_status=sess.status if sess else None,
                last_score=score,
            )
        )
    return out


async def list_assignments(db: AsyncSession, group: str | None) -> list[AssignmentOut]:
    stmt = select(Assignment, ScenarioTemplate).join(ScenarioTemplate).order_by(Assignment.created_at.desc())
    if group:
        stmt = stmt.where(Assignment.group_code == group)
    return [
        AssignmentOut(
            id=a.id,
            template=brief(t),
            group_code=a.group_code,
            user_id=a.user_id,
            due_at=a.due_at,
            created_at=a.created_at,
        )
        for a, t in (await db.execute(stmt)).all()
    ]
