"""Reports for students and teachers (ТЗ 4.2, ТП разд. 10: the period is mandatory)."""

import csv
import io
import statistics
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import CurrentUser, can_see_group
from app.errors import AppError, ErrorCode
from app.reports.models import Report
from app.scenarios.models import ScenarioRun, ScenarioTemplate, TemplateSkill
from app.sessions.models import Hint, LearningSession
from app.skills.models import Skill
from app.users.models import User
from app.verification.models import VerificationResult
from app.verification.router import review_status


def require_period(date_from: datetime | None, date_to: datetime | None) -> tuple[datetime, datetime]:
    if date_from is None or date_to is None:
        raise AppError(ErrorCode.REPORT_PERIOD_REQUIRED, "Укажите дату начала и дату окончания периода.")
    if date_from > date_to:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Дата начала позже даты окончания.")
    return date_from, date_to


async def get_report(
    db: AsyncSession, user: CurrentUser, report_id: uuid.UUID | None = None, session_id: uuid.UUID | None = None
) -> Report:
    if report_id is not None:
        r = await db.get(Report, report_id)
    else:
        r = await db.scalar(select(Report).where(Report.session_id == session_id))
    if r is None:
        raise AppError(ErrorCode.NOT_FOUND, "Отчёт не найден.")
    s = await db.get(LearningSession, r.session_id)
    assert s is not None
    if s.user_id != user.id:
        owner = await db.get(User, s.user_id)
        if not (owner is not None and can_see_group(user, owner.group_code)):
            raise AppError(ErrorCode.AUTH_FORBIDDEN, "Нет доступа к этому отчёту.")
    return r


async def report_owner(db: AsyncSession, r: Report) -> dict[str, Any]:
    s = await db.get(LearningSession, r.session_id)
    u = await db.get(User, s.user_id) if s else None
    return {"id": str(u.id), "full_name": u.full_name, "group": u.group_code} if u else {}


async def my_reports(db: AsyncSession, user: CurrentUser) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(Report, LearningSession)
            .join(LearningSession, LearningSession.id == Report.session_id)
            .where(LearningSession.user_id == user.id)
            .order_by(Report.created_at.desc())
        )
    ).all()
    out = []
    for r, s in rows:
        p = r.payload
        teacher = p.get("teacher") or {}
        out.append(
            {
                "id": str(r.id),
                "session_id": str(s.id),
                "title": p.get("title"),
                "domain": p.get("domain"),
                "score": teacher.get("score", p.get("score", {}).get("final")),
                "passed": p.get("score", {}).get("passed"),
                "created_at": r.created_at.isoformat(),
            }
        )
    return out


async def _rows(
    db: AsyncSession, user: CurrentUser, group: str | None, date_from: datetime, date_to: datetime, domain: str | None
) -> list[tuple[LearningSession, User, ScenarioTemplate, VerificationResult, int]]:
    if group and not can_see_group(user, group):
        raise AppError(ErrorCode.AUTH_FORBIDDEN, "Нет доступа к этой группе.")
    if not group and user.has("teacher") and not user.has("admin") and user.group_code:
        group = user.group_code
    stmt = (
        select(LearningSession, User, ScenarioTemplate, VerificationResult)
        .join(User, User.id == LearningSession.user_id)
        .join(ScenarioRun, ScenarioRun.id == LearningSession.run_id)
        .join(ScenarioTemplate, ScenarioTemplate.id == ScenarioRun.template_id)
        .join(VerificationResult, VerificationResult.session_id == LearningSession.id)
        .where(LearningSession.finished_at >= date_from, LearningSession.finished_at <= date_to)
        .order_by(LearningSession.finished_at.desc())
    )
    if group:
        stmt = stmt.where(User.group_code == group)
    if domain:
        stmt = stmt.where(ScenarioTemplate.domain_code == domain)
    rows = (await db.execute(stmt)).all()
    hints: dict[uuid.UUID, int] = defaultdict(int)
    ids = [r[0].id for r in rows]
    if ids:
        for sid in (await db.scalars(select(Hint.session_id).where(Hint.session_id.in_(ids)))).all():
            hints[sid] += 1
    return [(s, u, t, v, hints[s.id]) for s, u, t, v in rows]


def _effective(v: VerificationResult) -> int:
    return v.corrected_score if v.corrected_score is not None else v.final_score


async def group_overview(
    db: AsyncSession,
    user: CurrentUser,
    group: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    domain: str | None = None,
) -> dict[str, Any]:
    df, dt = require_period(date_from, date_to)
    rows = await _rows(db, user, group, df, dt, domain)
    scores = [_effective(v) for _, _, _, v, _ in rows]
    sessions = [
        {
            "session_id": str(s.id),
            "student": u.full_name,
            "student_id": str(u.id),
            "group": u.group_code,
            "title": t.title,
            "domain": t.domain_code,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            "auto_score": v.final_score,
            "expert_score": v.corrected_score,
            "review_status": review_status(v),
            "verification_status": v.status,
            "hints": h,
        }
        for s, u, t, v, h in rows
    ]
    # Problem skills: weighted share of failed checks over sessions of templates that target the skill.
    tpl_ids = {t.id for _, _, t, _, _ in rows}
    skills_by_tpl: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    if tpl_ids:
        for ts in (await db.scalars(select(TemplateSkill).where(TemplateSkill.template_id.in_(tpl_ids)))).all():
            skills_by_tpl[ts.template_id].append(ts.skill_id)
    fail_share: dict[uuid.UUID, list[float]] = defaultdict(list)
    for _, _, t, v, _ in rows:
        counted = [c for c in v.checks if not c.get("skipped")]
        total = sum(float(c["weight"]) for c in counted) or 1.0
        share = sum(float(c["weight"]) for c in counted if not c["passed"]) / total
        for sk in skills_by_tpl.get(t.id, []):
            fail_share[sk].append(share)
    names = (
        {s.id: s.name for s in (await db.scalars(select(Skill).where(Skill.id.in_(list(fail_share))))).all()}
        if fail_share
        else {}
    )
    problems = sorted(
        (
            {
                "skill_id": str(k),
                "name": names.get(k, "?"),
                "fail_percent": round(100 * statistics.mean(v)),
                "sessions": len(v),
            }
            for k, v in fail_share.items()
        ),
        key=lambda x: -int(str(x["fail_percent"])),
    )
    return {
        "period": {"from": df.isoformat(), "to": dt.isoformat()},
        "group": group,
        "kpi": {
            "sessions": len(rows),
            "students": len({u.id for _, u, _, _, _ in rows}),
            "avg_score": round(statistics.mean(scores)) if scores else None,
            "median_score": round(statistics.median(scores)) if scores else None,
            "hints_per_session": round(sum(h for *_, h in rows) / len(rows), 1) if rows else 0,
            "pending_review": sum(1 for s in sessions if s["review_status"] == "pending"),
        },
        "problem_skills": problems[:10],
        "sessions": sessions,
    }


async def export(
    db: AsyncSession,
    user: CurrentUser,
    group: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    fmt: str,
) -> tuple[str, str]:
    data = await group_overview(db, user, group, date_from, date_to)
    if fmt == "json":
        import json

        return json.dumps(data, ensure_ascii=False, indent=2), "application/json"
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(
        [
            "Обучающийся",
            "Группа",
            "Сценарий",
            "Завершена",
            "Авто-оценка",
            "Экспертная оценка",
            "Статус оценки",
            "Подсказки",
        ]
    )
    labels = {"pending": "ожидает", "confirmed": "подтверждена", "corrected": "скорректирована"}
    for s in data["sessions"]:
        w.writerow(
            [
                s["student"],
                s["group"] or "",
                s["title"],
                s["finished_at"] or "",
                s["auto_score"],
                "" if s["expert_score"] is None else s["expert_score"],
                labels[s["review_status"]],
                s["hints"],
            ]
        )
    return "﻿" + buf.getvalue(), "text/csv; charset=utf-8"
