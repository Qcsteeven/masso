"""AssessmentAgent (spec §9): collect_trace → run_checks → score → update_profile → build_report → cleanup."""

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment_agent.scoring import compute_score
from app.audit.models import SecurityEvent
from app.events.models import EnvironmentEvent
from app.events.service import record_event
from app.llm_gateway.gateway import LLMGateway
from app.profile_agent import service as profile
from app.reports.models import Report
from app.sandbox.manager import get_sandbox
from app.scenarios.models import ScenarioRun, ScenarioTemplate
from app.scenarios.spec import ContainerSpec, parse_spec
from app.sessions.models import Hint, LearningSession
from app.sessions.service import applied_incidents
from app.verification.engine import CheckContext, run_checks
from app.verification.models import VerificationResult

log = logging.getLogger("masso.assessment")


class AState(TypedDict, total=False):
    session_id: str
    hints: list[dict[str, Any]]
    violations: int
    incidents: list[dict[str, Any]]
    commands: int
    applied: list[str]
    checks: list[dict[str, Any]]
    score: dict[str, Any]
    skill_changes: list[dict[str, Any]]
    report_id: str
    timings: dict[str, int]


class AssessmentAgent:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        g: Any = StateGraph(AState)
        for name in ("collect_trace", "run_checks", "score", "update_profile", "build_report", "cleanup"):
            g.add_node(name, getattr(self, name))
        g.add_edge(START, "collect_trace")
        g.add_edge("collect_trace", "run_checks")
        g.add_edge("run_checks", "score")
        g.add_edge("score", "update_profile")
        g.add_edge("update_profile", "build_report")
        g.add_edge("build_report", "cleanup")
        g.add_edge("cleanup", END)
        self.graph = g.compile()

    async def _session(self, s: AState) -> LearningSession:
        row = await self.db.get(LearningSession, uuid.UUID(s["session_id"]))
        assert row is not None
        return row

    async def collect_trace(self, s: AState) -> AState:
        sess = await self._session(s)
        events = list(
            (
                await self.db.scalars(
                    select(EnvironmentEvent)
                    .where(EnvironmentEvent.session_id == sess.id)
                    .order_by(EnvironmentEvent.created_at)
                )
            ).all()
        )
        hints = (await self.db.scalars(select(Hint).where(Hint.session_id == sess.id).order_by(Hint.number))).all()
        violations = (
            await self.db.scalar(
                select(func.count())
                .select_from(SecurityEvent)
                .where(SecurityEvent.session_id == sess.id, SecurityEvent.kind != "login_failed")
            )
            or 0
        )
        return {
            "hints": [
                {
                    "number": h.number,
                    "text": h.text,
                    "penalty_percent": h.penalty_percent,
                    "created_at": h.created_at.isoformat(),
                }
                for h in hints
            ],
            "violations": int(violations),
            "incidents": [
                {"message": e.payload.get("message"), "created_at": e.created_at.isoformat()}
                for e in events
                if e.type == "incident"
            ],
            "commands": sum(1 for e in events if e.type == "command"),
            "applied": sorted(applied_incidents(sess, events)),
        }

    async def run_checks(self, s: AState) -> AState:
        t0 = time.perf_counter()
        sess = await self._session(s)
        run = await self.db.get(ScenarioRun, sess.run_id)
        assert run is not None
        spec = parse_spec(run.generated_spec)
        gw = LLMGateway(self.db)

        async def embed(texts: list[str]) -> tuple[list[list[float]], str]:
            r = await gw.embed(texts)
            return r.vectors, r.source

        ctx = CheckContext(applied_incidents=set(s.get("applied", [])), embed=embed)
        if isinstance(spec, ContainerSpec):
            ctx.container_id, ctx.sandbox = sess.sandbox_container_id, get_sandbox()
        else:
            ctx.answers = (sess.documents_state or {}).get("answers", {})
        results = [r.as_dict() for r in await run_checks(spec, ctx)]
        for r in results:
            record_event(
                self.db,
                sess,
                "check",
                {"id": r["id"], "title": r["title"], "passed": r["passed"], "skipped": r["skipped"]},
                "info" if r["passed"] else "warning",
            )
        return {"checks": results, "timings": {"checks_ms": int((time.perf_counter() - t0) * 1000)}}

    async def score(self, s: AState) -> AState:
        sess = await self._session(s)
        run = await self.db.get(ScenarioRun, sess.run_id)
        assert run is not None
        spec = parse_spec(run.generated_spec)
        sc = compute_score(s["checks"], len(s.get("hints", [])), s.get("violations", 0), spec.success.threshold)
        return {
            "score": {
                "base": sc.base,
                "final": sc.final,
                "passed": sc.passed,
                "critical_failed": sc.critical_failed,
                "hints": sc.hints,
                "violations": sc.violations,
                "threshold": sc.threshold,
                "formula": sc.formula(),
            }
        }

    async def update_profile(self, s: AState) -> AState:
        sess = await self._session(s)
        run = await self.db.get(ScenarioRun, sess.run_id)
        assert run is not None
        changes = await profile.apply_result(self.db, sess.user_id, run.template_id, bool(s["score"]["passed"]))
        return {
            "skill_changes": [
                {
                    "skill_id": str(c.skill_id),
                    "code": c.code,
                    "name": c.name,
                    "level_before": c.level_before,
                    "level_after": c.level_after,
                    "success_streak": c.success_streak,
                    "passed": c.passed,
                }
                for c in changes
            ]
        }

    async def build_report(self, s: AState) -> AState:
        sess = await self._session(s)
        run = await self.db.get(ScenarioRun, sess.run_id)
        assert run is not None
        tpl = await self.db.get(ScenarioTemplate, run.template_id)
        spec = parse_spec(run.generated_spec)
        now = datetime.now(UTC)
        sc = s["score"]
        failed = [c for c in s["checks"] if not c["passed"] and not c["skipped"]]
        errors = [{"check": c["title"], "critical": c["critical"]} for c in failed]
        rec: dict[str, Any] | None = None
        try:
            recs = await profile.recommendations(self.db, sess.user_id, spec.domain, now)
            if recs.deficits:
                d = recs.deficits[0]
                rec = {
                    "skill": d.name,
                    "priority": d.priority,
                    "template": recs.recommendations[0].title if recs.recommendations else None,
                }
        except Exception:
            log.exception("recommendation failed")
        vr = await self.db.scalar(select(VerificationResult).where(VerificationResult.session_id == sess.id))
        if vr is None:
            vr = VerificationResult(
                session_id=sess.id, checks=[], base_score=0, final_score=0, status="failed", errors=[]
            )
            self.db.add(vr)
        vr.checks = [
            {k: c[k] for k in ("id", "title", "type", "weight", "critical", "passed", "skipped", "judge")}
            for c in s["checks"]
        ]
        vr.base_score, vr.final_score = sc["base"], sc["final"]
        vr.status = "passed" if sc["passed"] else "failed"
        vr.errors = errors
        spent = int(((sess.finished_at or now) - sess.started_at).total_seconds()) if sess.started_at else 0
        payload = {
            "session_id": str(sess.id),
            "run_id": str(run.id),
            "template_code": tpl.code if tpl else spec.code,
            "title": spec.title,
            "domain": spec.domain,
            "kind": spec.kind,
            "legend": spec.legend_text,
            "score": sc,
            "checks": [
                {k: c[k] for k in ("id", "title", "weight", "critical", "passed", "skipped")} for c in s["checks"]
            ],
            "errors": errors,
            "hints": s.get("hints", []),
            "incidents": s.get("incidents", []),
            "violations": s.get("violations", 0),
            "commands": s.get("commands", 0),
            "time_spent_sec": spent,
            "time_limit_min": sess.time_limit_min,
            "skill_changes": s.get("skill_changes", []),
            "recommendation": rec,
            "teacher": None,
            "created_at": now.isoformat(),
        }
        report = await self.db.scalar(select(Report).where(Report.session_id == sess.id))
        if report is None:
            report = Report(session_id=sess.id, payload=payload)
            self.db.add(report)
        else:
            report.payload = payload
        await self.db.flush()
        return {"report_id": str(report.id)}

    async def cleanup(self, s: AState) -> AState:
        t0 = time.perf_counter()
        sess = await self._session(s)
        if sess.sandbox_container_id:
            try:
                await get_sandbox().remove(sess.sandbox_container_id)
            except Exception:
                log.exception("cleanup failed for %s", sess.id)
            sess.sandbox_container_id = None
        return {"timings": {**s.get("timings", {}), "cleanup_ms": int((time.perf_counter() - t0) * 1000)}}

    async def run(self, session_id: uuid.UUID) -> AState:
        out: AState = await self.graph.ainvoke({"session_id": str(session_id)})
        return out
