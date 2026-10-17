"""ProfileAgent: deficits, recommendations, profile update (spec §6). DB adapter over algorithms.py."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import record_audit
from app.profile_agent import algorithms as alg
from app.scenarios.models import ScenarioRun, ScenarioTemplate, TemplateSkill
from app.sessions.models import LearningSession
from app.skills.models import Skill, SkillRequires, TrackTarget, UserSkill
from app.skills.schemas import DeficitOut, RecommendationOut, RecommendationsOut
from app.verification.models import VerificationResult

RECENT_PASS_DAYS = 7


async def _states(db: AsyncSession, user_id: uuid.UUID) -> dict[uuid.UUID, alg.SkillState]:
    rows = (await db.scalars(select(UserSkill).where(UserSkill.user_id == user_id))).all()
    return {
        r.skill_id: alg.SkillState(r.level, r.last_confirmed, r.success_streak, r.success_count, r.fail_count)
        for r in rows
    }


async def _edges(db: AsyncSession) -> list[alg.Edge]:
    return [
        alg.Edge(r.skill_id, r.requires_skill_id, float(r.weight))
        for r in (await db.scalars(select(SkillRequires))).all()
    ]


async def deficits(db: AsyncSession, user_id: uuid.UUID, domain: str, now: datetime | None = None) -> list[DeficitOut]:
    now = now or datetime.now(UTC)
    targets = {
        t.skill_id: t.required_level
        for t in (await db.scalars(select(TrackTarget).where(TrackTarget.domain_code == domain))).all()
    }
    res = alg.compute_deficits(targets, await _states(db, user_id), await _edges(db), now)
    skills = {s.id: s for s in (await db.scalars(select(Skill).where(Skill.id.in_(targets)))).all()}
    return [
        DeficitOut(
            skill_id=d.skill_id,
            code=skills[d.skill_id].code,
            name=skills[d.skill_id].name,
            current_level=d.current_level,
            required_level=d.required_level,
            gap=d.gap,
            stale=d.stale,
            days_since_confirmed=d.days_since_confirmed,
            dependents=d.dependents,
            priority=d.priority.code,
        )
        for d in res
    ]


async def recommendations(
    db: AsyncSession, user_id: uuid.UUID, domain: str, now: datetime | None = None
) -> RecommendationsOut:
    now = now or datetime.now(UTC)
    defs = await deficits(db, user_id, domain, now)
    alg_defs = [
        alg.Deficit(
            skill_id=d.skill_id,
            current_level=d.current_level,
            required_level=d.required_level,
            gap=d.gap,
            stale=d.stale,
            days_since_confirmed=d.days_since_confirmed,
            dependents=d.dependents,
            out_weight=0.0,
            priority=alg.Priority[d.priority.upper()],
        )
        for d in defs
    ]
    templates = (await db.scalars(select(ScenarioTemplate).where(ScenarioTemplate.status == "published"))).all()
    tskills: dict[uuid.UUID, dict[uuid.UUID, float]] = {}
    for ts in (
        await db.scalars(select(TemplateSkill).where(TemplateSkill.template_id.in_([t.id for t in templates])))
    ).all():
        tskills.setdefault(ts.template_id, {})[ts.skill_id] = float(ts.weight)
    passed_recent = set(
        (
            await db.scalars(
                select(ScenarioRun.template_id)
                .join(LearningSession, LearningSession.run_id == ScenarioRun.id)
                .join(VerificationResult, VerificationResult.session_id == LearningSession.id)
                .where(
                    LearningSession.user_id == user_id,
                    VerificationResult.status == "passed",
                    LearningSession.finished_at >= now - timedelta(days=RECENT_PASS_DAYS),
                )
            )
        ).all()
    )
    recs = alg.rank_templates(
        alg_defs, [alg.TemplateCandidate(t.id, tskills.get(t.id, {}), t.id in passed_recent) for t in templates]
    )
    by_id = {t.id: t for t in templates}
    code = {d.skill_id: d.code for d in defs}
    return RecommendationsOut(
        domain=domain,
        deficits=defs,
        recommendations=[
            RecommendationOut(
                template_id=r.template_id,
                code=by_id[r.template_id].code,
                title=by_id[r.template_id].title,
                domain_code=by_id[r.template_id].domain_code,
                kind=by_id[r.template_id].kind,
                score=r.score,
                covers=[code[s] for s in r.covers],
            )
            for r in recs
        ],
    )


@dataclass(frozen=True)
class SkillChange:
    skill_id: uuid.UUID
    code: str
    name: str
    level_before: int
    level_after: int
    success_streak: int
    passed: bool


async def apply_result(
    db: AsyncSession, user_id: uuid.UUID, template_id: uuid.UUID, passed: bool, now: datetime | None = None
) -> list[SkillChange]:
    """Update user_skills for every TARGETS skill of the template; a level change is audited. Caller commits."""
    now = now or datetime.now(UTC)
    targets = (await db.scalars(select(TemplateSkill).where(TemplateSkill.template_id == template_id))).all()
    changes: list[SkillChange] = []
    for t in targets:
        skill = await db.get(Skill, t.skill_id)
        if skill is None:
            continue
        row = await db.get(UserSkill, (user_id, t.skill_id))
        if row is None:
            row = UserSkill(
                user_id=user_id, skill_id=t.skill_id, level=0, success_streak=0, success_count=0, fail_count=0
            )
            db.add(row)
        before = alg.SkillState(row.level, row.last_confirmed, row.success_streak, row.success_count, row.fail_count)
        after = alg.apply_result(before, passed, now, skill.level_max)
        row.level, row.last_confirmed = after.level, after.last_confirmed
        row.success_streak, row.success_count, row.fail_count = (
            after.success_streak,
            after.success_count,
            after.fail_count,
        )
        if after.level != before.level:
            record_audit(
                db,
                actor_id=None,
                action="skill.level_up",
                object_type="user_skill",
                object_id=f"{user_id}:{skill.code}",
                before={"level": before.level},
                after={"level": after.level},
                reason="ProfileAgent: три успешных подтверждения подряд",
            )
        changes.append(
            SkillChange(skill.id, skill.code, skill.name, before.level, after.level, after.success_streak, passed)
        )
    await db.flush()
    return changes
