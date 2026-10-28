"""Competency graph: skills, REQUIRES edges, track targets, import (spec §3, ТЗ 4.2)."""

import csv
import io
import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import record_audit
from app.errors import AppError, ErrorCode
from app.profile_agent.algorithms import Edge, dependents_count, find_cycle, is_outdated
from app.skills.models import Domain, Skill, SkillRequires, TrackTarget, UserSkill
from app.skills.schemas import (
    DomainCreate,
    DomainOut,
    DomainPatch,
    EdgeOut,
    GraphOut,
    MySkillOut,
    SkillCreate,
    SkillOut,
    SkillPatch,
    TargetOut,
    TargetsPut,
)


async def _all_edges(db: AsyncSession) -> list[SkillRequires]:
    return list((await db.scalars(select(SkillRequires))).all())


def _edges(rows: list[SkillRequires]) -> list[Edge]:
    return [Edge(r.skill_id, r.requires_skill_id, float(r.weight)) for r in rows]


async def _ensure_acyclic(db: AsyncSession, codes: dict[uuid.UUID, str] | None = None) -> None:
    rows = await _all_edges(db)
    cycle = find_cycle((r.skill_id, r.requires_skill_id) for r in rows)
    if cycle:
        if codes is None:
            codes = dict((await db.execute(select(Skill.id, Skill.code))).all())
        names = " → ".join(codes.get(c, str(c)) for c in [*cycle, cycle[0]])
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Граф компетенций должен быть ацикличным: цикл {names}.",
            {"cycle": [str(c) for c in cycle]},
        )


async def get_graph(db: AsyncSession, domain: str | None) -> GraphOut:
    domains = (await db.scalars(select(Domain).order_by(Domain.code))).all()
    counts = dict((await db.execute(select(Skill.domain_code, func.count()).group_by(Skill.domain_code))).all())
    stmt = select(Skill).order_by(Skill.code)
    if domain:
        stmt = stmt.where(Skill.domain_code == domain)
    skills = (await db.scalars(stmt)).all()
    edges = await _all_edges(db)
    deps = dependents_count(_edges(edges))
    ids = {s.id for s in skills}
    if domain:
        # keep edges touching the domain; prerequisite skills from other domains are added for context
        edges = [e for e in edges if e.skill_id in ids or e.requires_skill_id in ids]
        extra = {e.requires_skill_id for e in edges} | {e.skill_id for e in edges}
        missing = extra - ids
        if missing:
            skills = [*skills, *(await db.scalars(select(Skill).where(Skill.id.in_(missing)))).all()]
    tstmt = select(TrackTarget)
    if domain:
        tstmt = tstmt.where(TrackTarget.domain_code == domain)
    targets = (await db.scalars(tstmt)).all()
    return GraphOut(
        domains=[
            DomainOut(code=d.code, name=d.name, description=d.description, skills_count=counts.get(d.code, 0))
            for d in domains
        ],
        skills=[
            SkillOut(
                id=s.id,
                code=s.code,
                domain_code=s.domain_code,
                name=s.name,
                description=s.description,
                theory=s.theory,
                level_max=s.level_max,
                status=s.status,
                dependents=deps.get(s.id, 0),
            )
            for s in skills
        ],
        edges=[
            EdgeOut(skill_id=e.skill_id, requires_skill_id=e.requires_skill_id, weight=float(e.weight)) for e in edges
        ],
        targets=[
            TargetOut(domain_code=t.domain_code, skill_id=t.skill_id, required_level=t.required_level) for t in targets
        ],
        acyclic=True,
    )


async def list_domains(db: AsyncSession) -> list[DomainOut]:
    counts = dict((await db.execute(select(Skill.domain_code, func.count()).group_by(Skill.domain_code))).all())
    return [
        DomainOut(code=d.code, name=d.name, description=d.description, skills_count=counts.get(d.code, 0))
        for d in (await db.scalars(select(Domain).order_by(Domain.name))).all()
    ]


async def create_domain(db: AsyncSession, actor_id: uuid.UUID, body: DomainCreate) -> DomainOut:
    if await db.get(Domain, body.code) is not None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Домен с таким кодом уже существует.")
    d = Domain(code=body.code, name=body.name, description=body.description)
    db.add(d)
    record_audit(
        db, actor_id=actor_id, action="domain.create", object_type="domain", object_id=d.code, after=body.model_dump()
    )
    await db.commit()
    return DomainOut(code=d.code, name=d.name, description=d.description)


async def patch_domain(db: AsyncSession, actor_id: uuid.UUID, code: str, body: DomainPatch) -> DomainOut:
    d = await db.get(Domain, code)
    if d is None:
        raise AppError(ErrorCode.NOT_FOUND, "Домен не найден.")
    before = {"name": d.name, "description": d.description}
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(d, k, v)
    after = {"name": d.name, "description": d.description}
    record_audit(
        db, actor_id=actor_id, action="domain.update", object_type="domain", object_id=code, before=before, after=after
    )
    await db.commit()
    count = await db.scalar(select(func.count()).select_from(Skill).where(Skill.domain_code == code))
    return DomainOut(code=d.code, name=d.name, description=d.description, skills_count=count or 0)


async def _domain_exists(db: AsyncSession, code: str) -> None:
    if await db.get(Domain, code) is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Неизвестная предметная область: {code}.")


async def _set_requires(db: AsyncSession, skill_id: uuid.UUID, requires: list[Any]) -> None:
    await db.execute(delete(SkillRequires).where(SkillRequires.skill_id == skill_id))
    for r in requires:
        if r.skill_id == skill_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Навык не может требовать сам себя.")
        if await db.get(Skill, r.skill_id) is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Указан несуществующий prerequisite-навык.")
        db.add(SkillRequires(skill_id=skill_id, requires_skill_id=r.skill_id, weight=Decimal(str(round(r.weight, 2)))))
    await db.flush()


def _skill_dict(s: Skill) -> dict[str, Any]:
    return {"code": s.code, "name": s.name, "domain_code": s.domain_code, "level_max": s.level_max, "status": s.status}


async def create_skill(db: AsyncSession, actor_id: uuid.UUID, body: SkillCreate) -> SkillOut:
    await _domain_exists(db, body.domain_code)
    if await db.scalar(select(Skill.id).where(Skill.code == body.code)):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Навык с таким кодом уже существует.")
    skill = Skill(
        code=body.code,
        domain_code=body.domain_code,
        name=body.name,
        description=body.description,
        theory=body.theory,
        level_max=body.level_max,
        status=body.status,
        created_by=actor_id,
    )
    db.add(skill)
    await db.flush()
    await _set_requires(db, skill.id, body.requires)
    await _ensure_acyclic(db)
    record_audit(
        db,
        actor_id=actor_id,
        action="skill.create",
        object_type="skill",
        object_id=str(skill.id),
        after={**_skill_dict(skill), "requires": [str(r.skill_id) for r in body.requires]},
    )
    await db.commit()
    return SkillOut(
        id=skill.id,
        code=skill.code,
        domain_code=skill.domain_code,
        name=skill.name,
        description=skill.description,
        theory=skill.theory,
        level_max=skill.level_max,
        status=skill.status,
    )


async def patch_skill(db: AsyncSession, actor_id: uuid.UUID, skill_id: uuid.UUID, body: SkillPatch) -> SkillOut:
    skill = await db.get(Skill, skill_id)
    if skill is None:
        raise AppError(ErrorCode.NOT_FOUND, "Навык не найден.")
    before = _skill_dict(skill)
    data = body.model_dump(exclude_unset=True, exclude={"requires"})
    theory_changed = data.get("theory") is not None and data["theory"] != skill.theory
    if data.get("domain_code"):
        await _domain_exists(db, data["domain_code"])
    for k, v in data.items():
        if v is not None:
            setattr(skill, k, v)
    if body.requires is not None:
        await _set_requires(db, skill.id, body.requires)
        await _ensure_acyclic(db)
    record_audit(
        db,
        actor_id=actor_id,
        action="skill.update",
        object_type="skill",
        object_id=str(skill.id),
        before=before,
        after={
            **_skill_dict(skill),
            **({"requires": [str(r.skill_id) for r in body.requires]} if body.requires is not None else {}),
            **({"theory_changed": True} if theory_changed else {}),
        },
    )
    await db.commit()
    deps = dependents_count(_edges(await _all_edges(db)))
    return SkillOut(
        id=skill.id,
        code=skill.code,
        domain_code=skill.domain_code,
        name=skill.name,
        description=skill.description,
        theory=skill.theory,
        level_max=skill.level_max,
        status=skill.status,
        dependents=deps.get(skill.id, 0),
    )


def parse_import(fmt: str, content: str) -> dict[str, Any]:
    """Normalise JSON or CSV import into {"skills": [...], "targets": [...]}."""
    if fmt == "json":
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Некорректный JSON: {exc.msg}.") from None
        if not isinstance(data, dict) or not isinstance(data.get("skills"), list):
            raise AppError(ErrorCode.VALIDATION_ERROR, "Ожидается объект с массивом skills.")
        return data
    reader = csv.DictReader(io.StringIO(content.lstrip("﻿")))
    need = {"code", "domain", "name"}
    if not reader.fieldnames or not need.issubset(reader.fieldnames):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "CSV должен содержать колонки code, domain, name "
            "(необязательные: level_max, description, requires, required_level).",
        )
    skills: list[dict[str, Any]] = []
    targets: list[dict[str, Any]] = []
    for i, row in enumerate(reader, start=2):
        req = []
        for part in filter(None, (row.get("requires") or "").replace(",", ";").split(";")):
            code, _, w = part.strip().partition(":")
            try:
                req.append({"code": code.strip(), "weight": float(w) if w else 1.0})
            except ValueError:
                raise AppError(ErrorCode.VALIDATION_ERROR, f"Строка {i}: некорректный вес связи «{part}».") from None
        skills.append(
            {
                "code": row["code"].strip(),
                "domain": row["domain"].strip(),
                "name": row["name"].strip(),
                "description": (row.get("description") or "").strip(),
                "level_max": int(row.get("level_max") or 5),
                "requires": req,
            }
        )
        if row.get("required_level"):
            targets.append(
                {
                    "domain": row["domain"].strip(),
                    "skill": row["code"].strip(),
                    "required_level": int(row["required_level"]),
                }
            )
    return {"skills": skills, "targets": targets}


async def import_graph_data(
    db: AsyncSession, data: dict[str, Any], actor_id: uuid.UUID | None, replace: bool
) -> dict[str, int]:
    """Upsert skills by code, replace their REQUIRES edges, upsert targets; graph must stay acyclic.

    The caller commits; on error the session must be rolled back.
    """
    for d in data.get("domains", []):
        if await db.get(Domain, d["code"]) is None:
            db.add(Domain(code=d["code"], name=d.get("name", d["code"]), description=d.get("description", "")))
    await db.flush()
    by_code: dict[str, Skill] = {s.code: s for s in (await db.scalars(select(Skill))).all()}
    created = updated = 0
    touched: set[str] = set()
    for item in data["skills"]:
        code = str(item.get("code", "")).strip()
        if not code or not item.get("name") or not item.get("domain"):
            raise AppError(ErrorCode.VALIDATION_ERROR, "У каждого навыка должны быть code, domain и name.")
        await _domain_exists(db, item["domain"])
        s = by_code.get(code)
        if s is None:
            s = Skill(
                code=code,
                domain_code=item["domain"],
                name=item["name"],
                status=item.get("status", "active"),
                description=item.get("description", ""),
                theory=item.get("theory", ""),
                level_max=int(item.get("level_max", 5)),
                created_by=actor_id,
            )
            db.add(s)
            by_code[code] = s
            created += 1
            touched.add(code)
        else:
            if not replace:
                # a repeated seed adds theory to skills that have none, never overwriting the methodist's text
                if not s.theory and item.get("theory"):
                    s.theory = item["theory"]
                continue
            s.name, s.domain_code = item["name"], item["domain"]
            s.description = item.get("description", s.description)
            s.theory = item.get("theory", s.theory)
            s.level_max = int(item.get("level_max", s.level_max))
            updated += 1
            touched.add(code)
    await db.flush()
    edges = 0
    for item in data["skills"]:
        if item["code"].strip() not in touched:
            continue
        s = by_code[item["code"].strip()]
        await db.execute(delete(SkillRequires).where(SkillRequires.skill_id == s.id))
        for r in item.get("requires", []):
            dep = by_code.get(str(r["code"]).strip())
            if dep is None:
                raise AppError(ErrorCode.VALIDATION_ERROR, f"Навык {s.code} ссылается на неизвестный {r['code']}.")
            w = float(r.get("weight", 1.0))
            if not 0 <= w <= 1:
                raise AppError(ErrorCode.VALIDATION_ERROR, f"Вес связи {s.code} → {dep.code} должен быть от 0 до 1.")
            if dep.id == s.id:
                raise AppError(ErrorCode.VALIDATION_ERROR, f"Навык {s.code} не может требовать сам себя.")
            db.add(SkillRequires(skill_id=s.id, requires_skill_id=dep.id, weight=Decimal(str(round(w, 2)))))
            edges += 1
    await db.flush()
    await _ensure_acyclic(db, {s.id: c for c, s in by_code.items()})
    targets = 0
    for t in data.get("targets", []):
        skill = by_code.get(t["skill"])
        if skill is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Целевой уровень для неизвестного навыка {t['skill']}.")
        row = await db.get(TrackTarget, (t["domain"], skill.id))
        if row is None:
            db.add(TrackTarget(domain_code=t["domain"], skill_id=skill.id, required_level=int(t["required_level"])))
        else:
            row.required_level = int(t["required_level"])
        targets += 1
    await db.flush()
    summary = {"created": created, "updated": updated, "edges": edges, "targets": targets}
    if actor_id is not None:
        record_audit(
            db, actor_id=actor_id, action="skill.import", object_type="skill_graph", object_id="-", after=summary
        )
    return summary


async def import_graph(db: AsyncSession, actor_id: uuid.UUID, fmt: str, content: str, replace: bool) -> dict[str, int]:
    data = parse_import(fmt, content)
    try:
        summary = await import_graph_data(db, data, actor_id, replace)
    except AppError:
        await db.rollback()
        raise
    await db.commit()
    return summary


async def set_targets(db: AsyncSession, actor_id: uuid.UUID, body: TargetsPut) -> list[TargetOut]:
    await _domain_exists(db, body.domain_code)
    before = {
        str(t.skill_id): t.required_level
        for t in (await db.scalars(select(TrackTarget).where(TrackTarget.domain_code == body.domain_code))).all()
    }
    await db.execute(delete(TrackTarget).where(TrackTarget.domain_code == body.domain_code))
    for it in body.items:
        if await db.get(Skill, it.skill_id) is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Указан несуществующий навык.")
        db.add(TrackTarget(domain_code=body.domain_code, skill_id=it.skill_id, required_level=it.required_level))
    record_audit(
        db,
        actor_id=actor_id,
        action="skill.targets",
        object_type="domain",
        object_id=body.domain_code,
        before=before,
        after={str(i.skill_id): i.required_level for i in body.items},
    )
    await db.commit()
    return [
        TargetOut(domain_code=body.domain_code, skill_id=i.skill_id, required_level=i.required_level)
        for i in body.items
    ]


async def my_skills(db: AsyncSession, user_id: uuid.UUID, domain: str | None) -> list[MySkillOut]:
    now = datetime.now(UTC)
    stmt = select(Skill, UserSkill).outerjoin(
        UserSkill, (UserSkill.skill_id == Skill.id) & (UserSkill.user_id == user_id)
    )
    if domain:
        stmt = stmt.where(Skill.domain_code == domain)
    targets = {(t.domain_code, t.skill_id): t.required_level for t in (await db.scalars(select(TrackTarget))).all()}
    out: list[MySkillOut] = []
    for skill, us in (await db.execute(stmt.order_by(Skill.domain_code, Skill.code))).all():
        req = targets.get((skill.domain_code, skill.id))
        if us is None and req is None:
            continue
        out.append(
            MySkillOut(
                skill_id=skill.id,
                code=skill.code,
                name=skill.name,
                domain_code=skill.domain_code,
                level=us.level if us else 0,
                level_max=skill.level_max,
                required_level=req,
                last_confirmed=us.last_confirmed if us else None,
                success_streak=us.success_streak if us else 0,
                success_count=us.success_count if us else 0,
                fail_count=us.fail_count if us else 0,
                outdated=is_outdated(us.last_confirmed if us else None, now),
            )
        )
    return out
