"""ScenarioAgent (spec §9): LangGraph graph of generation and validation.

select_params → generate_legend (LLM | template) → assemble_spec → static_validate → dedup (pgvector ≥ 0.90,
regenerate ≤ 2 times) → dynamic_validate → publish | reject. The validation report is stored with the run;
a run without a confirmed solution path is never published (ТЗ 4.2).
"""

import logging
import random
import re
import time
import uuid
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm_gateway.gateway import LLMGateway
from app.scenarios.generators import GENERATORS, reference_answer
from app.scenarios.spec import ContainerSpec, DocumentSpec, parse_spec
from app.verification.engine import CheckContext, all_passed, any_failed, run_checks

log = logging.getLogger("masso.scenario_agent")

DEDUP_THRESHOLD = 0.90
MAX_REGEN = 2


class LegendOut(BaseModel):
    legend: str = Field(min_length=60, max_length=1500)


class State(TypedDict, total=False):
    template_id: str
    template_code: str
    user_id: str | None
    base: dict[str, Any]
    seed: int
    attempt: int
    params: dict[str, Any]
    spec: dict[str, Any]
    legend: str
    mode: str
    provider: str
    embedding: list[float]
    similarity: float
    steps: list[dict[str, Any]]
    errors: list[str]
    status: str
    run_id: str


def _step(state: State, name: str, ok: bool, detail: str, t0: float) -> list[dict[str, Any]]:
    return [
        *state.get("steps", []),
        {"step": name, "ok": ok, "detail": detail, "duration_ms": int((time.perf_counter() - t0) * 1000)},
    ]


class _SafeDict(dict[str, Any]):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _fmt(template: str, params: dict[str, Any]) -> str:
    return template.format_map(_SafeDict(params))


def secrets_of(spec: ContainerSpec | DocumentSpec) -> list[str]:
    """Strings that must never appear in student-facing text (fix commands, secret values)."""
    out: list[str] = []
    if isinstance(spec, ContainerSpec):
        for f in spec.faults.catalog.values():
            out.append(f.fix)
            out.extend(re.findall(r"=([A-Za-z0-9_\-]{6,})/", f.fix))
    else:
        out.extend(a.expected_fix for a in spec.answer_key if a.expected_fix)
    return [s for s in out if s]


class ScenarioAgent:
    def __init__(
        self, db: AsyncSession, gateway: LLMGateway, sandbox: Any | None, *, validation_timeout: float = 90.0
    ) -> None:
        self.db, self.gw, self.sandbox = db, gateway, sandbox
        self.validation_timeout = validation_timeout
        self.graph = self._build()

    # ---------------- nodes
    async def select_params(self, s: State) -> State:
        t0 = time.perf_counter()
        rng = random.Random(s["seed"] + 7919 * s.get("attempt", 0))
        base = dict(s["base"])
        params = {k: rng.choice(v) for k, v in base.get("params", {}).items() if v}
        chosen: dict[str, Any] = {"params": params}
        if base["kind"] == "container":
            chosen["initial_fault"] = rng.choice(base["faults"]["initial"])
            pick = base.get("incidents_pick")
            if pick and base.get("incidents"):
                # incident pool: a random subset in random order; dynamic validation runs each chosen incident
                base["incidents"] = rng.sample(
                    base["incidents"], rng.randint(pick[0], min(pick[1], len(base["incidents"])))
                )
                chosen["incidents"] = [i["id"] for i in base["incidents"]]
                base["incidents_pick"] = None  # the variant has a fixed list
        elif base.get("builder"):
            gen = GENERATORS[base["builder"]](rng)
            params.update(gen.params)
            base.update(
                documents=[d.model_dump() for d in gen.documents],
                answer_key=[a.model_dump() for a in gen.answer_key],
                checks=[c.model_dump() for c in gen.checks],
                incidents=[i.model_dump() for i in gen.incidents],
                answer_form=gen.answer_form,
                defect_catalog=gen.defect_catalog,
            )
        base["chosen"] = chosen
        return {
            "params": params,
            "spec": base,
            "steps": _step(s, "select_params", True, f"попытка {s.get('attempt', 0) + 1}", t0),
        }

    async def generate_legend(self, s: State) -> State:
        t0 = time.perf_counter()
        spec, params = s["spec"], s["params"]
        forbidden = secrets_of(parse_spec(spec))

        def _check(v: LegendOut) -> None:
            low = v.legend.lower()
            for bad in ("supervisorctl", "sed ", "systemctl", "```", *forbidden):
                if bad and bad.lower() in low:
                    raise ValueError("легенда не должна содержать команды и элементы решения")

        brief = _fmt(spec["legend"].get("brief") or spec["legend"]["template"], params)
        res = await self.gw.complete_json(
            "scenario.legend",
            [{"role": "user", "content": brief + "\nВерни JSON с полем legend (русский язык, без markdown)."}],
            LegendOut,
            agent="scenario",
            temperature=0.8,
            max_tokens=700,
            validate=_check,
        )
        if res is not None:
            return {
                "legend": res.value.legend.strip(),
                "mode": res.mode,
                "provider": res.provider,
                "steps": _step(s, "generate_legend", True, f"LLM: {res.provider}", t0),
            }
        variants = spec.get("variants") or []
        rng = random.Random(s["seed"] + s.get("attempt", 0))
        matching = [
            v for v in variants if v.get("params") and all(params.get(k) == val for k, val in v["params"].items())
        ]
        generic = [v for v in variants if not v.get("params")]
        pool = matching or generic
        legend = rng.choice(pool)["legend"] if pool else _fmt(spec["legend"]["template"], params)
        return {
            "legend": legend,
            "mode": "template",
            "provider": "template",
            "steps": _step(s, "generate_legend", True, "шаблонный режим: утверждённый вариант легенды", t0),
        }

    async def assemble_spec(self, s: State) -> State:
        spec = dict(s["spec"])
        spec["legend_text"] = s["legend"]
        spec["chosen"] = {**spec.get("chosen", {}), "generation_mode": s.get("mode", "template")}
        return {"spec": spec}

    async def static_validate(self, s: State) -> State:
        t0 = time.perf_counter()
        errors: list[str] = []
        try:
            spec = parse_spec(s["spec"])
        except ValidationError as exc:
            errors.append("спецификация не соответствует схеме: " + "; ".join(e["msg"] for e in exc.errors()[:5]))
            return {"errors": errors, "status": "rejected", "steps": _step(s, "static_validate", False, errors[0], t0)}
        for hint in spec.hints.ladder:
            for bad in secrets_of(spec):
                if bad and bad in hint:
                    errors.append("подсказка содержит элемент эталонного решения")
        if sum(c.weight for c in spec.checks) <= 0:
            errors.append("суммарный вес проверок должен быть положительным")
        ok = not errors
        return {
            "errors": errors,
            "status": "" if ok else "rejected",
            "steps": _step(s, "static_validate", ok, "схема и бизнес-правила" if ok else "; ".join(errors), t0),
        }

    async def dedup(self, s: State) -> State:
        t0 = time.perf_counter()
        emb = await self.gw.embed([s["legend"]])
        vec = emb.vectors[0]
        sim = 0.0
        if s.get("user_id"):
            row = (
                await self.db.execute(
                    text(
                        "SELECT 1 - (legend_embedding <=> CAST(:v AS vector)) AS sim FROM scenario_runs "
                        "WHERE template_id = :t AND user_id = :u AND legend_embedding IS NOT NULL "
                        "ORDER BY legend_embedding <=> CAST(:v AS vector) LIMIT 1"
                    ),
                    {"v": str(vec), "t": s["template_id"], "u": s["user_id"]},
                )
            ).first()
            sim = float(row[0]) if row else 0.0
        dup = sim >= DEDUP_THRESHOLD
        detail = f"максимальное сходство {sim:.2f} (порог {DEDUP_THRESHOLD:.2f}, эмбеддинги: {emb.source})"
        out: State = {"embedding": vec, "similarity": sim, "steps": _step(s, "dedup", not dup, detail, t0)}
        if dup:
            out["attempt"] = s.get("attempt", 0) + 1
        return out

    async def dynamic_validate(self, s: State) -> State:
        t0 = time.perf_counter()
        spec = parse_spec(s["spec"])
        try:
            if isinstance(spec, ContainerSpec):
                ok, detail, sub = await self._validate_container(spec)
            else:
                ok, detail, sub = await self._validate_document(spec)
        except Exception as exc:  # sandbox failures reject the run instead of crashing generation
            log.exception("dynamic validation failed")
            ok, detail, sub = False, f"ошибка прогона: {str(exc)[:200]}", []
        steps = [*_step(s, "dynamic_validate", ok, detail, t0), *sub]
        return {
            "status": "published" if ok else "rejected",
            "steps": steps,
            "errors": [*s.get("errors", []), *([] if ok else [detail])],
        }

    async def _validate_document(self, spec: DocumentSpec) -> tuple[bool, str, list[dict[str, Any]]]:
        sub: list[dict[str, Any]] = []
        docs = {d.id: d.markdown for d in spec.documents}
        all_text = "\n".join(docs.values())
        missing = [a.id for a in spec.answer_key if a.quote and a.quote not in all_text]
        sub.append(
            {
                "step": "quotes",
                "ok": not missing,
                "detail": "цитаты дефектов есть в документах" if not missing else f"нет цитат: {missing}",
            }
        )
        key = list(spec.answer_key)
        applied: set[str] = set()
        for inc in spec.incidents:
            if inc.mutation is not None:
                ok_m = inc.mutation.find in docs.get(inc.mutation.doc_id, "")
                sub.append(
                    {
                        "step": f"incident:{inc.id}",
                        "ok": ok_m,
                        "detail": "изменение документа применимо" if ok_m else "фрагмент для изменения не найден",
                    }
                )
                if not ok_m:
                    missing.append(inc.id)
            if inc.adds_answer:
                from app.scenarios.spec import AnswerItem

                item = AnswerItem.model_validate(inc.adds_answer)
                if item.quote and item.quote not in all_text:
                    missing.append(item.id)
                key.append(item)
            applied.add(inc.id)

        async def embed(texts: list[str]) -> tuple[list[list[float]], str]:
            r = await self.gw.embed(texts)
            return r.vectors, r.source

        ideal = reference_answer(key, spec.checks)
        good = await run_checks(spec, CheckContext(answers=ideal, applied_incidents=applied, embed=embed))
        empty = await run_checks(spec, CheckContext(answers={"findings": []}, applied_incidents=applied, embed=embed))
        sub.append(
            {
                "step": "reference_answer",
                "ok": all_passed(good),
                "detail": f"эталонный ответ: {sum(r.passed for r in good)} из {len(good)} проверок",
            }
        )
        sub.append({"step": "empty_answer", "ok": any_failed(empty), "detail": "пустой ответ не проходит проверки"})
        ok = not missing and all_passed(good) and any_failed(empty)
        return ok, "путь решения подтверждён" if ok else "путь решения не подтверждён", sub

    async def _validate_container(self, spec: ContainerSpec) -> tuple[bool, str, list[dict[str, Any]]]:
        if self.sandbox is None:
            return False, "песочница недоступна", []
        from app.sandbox.manager import Profile
        from app.sandbox.service import load_profile

        sub: list[dict[str, Any]] = []
        profile: Profile = await load_profile(self.db, spec.profile)
        sb = self.sandbox
        cid = await sb.create(uuid.uuid4().hex, "validator", profile, kind="validation")
        try:
            ctx = CheckContext(container_id=cid, sandbox=sb)

            async def phase(name: str, script: str | None, expect_pass: bool) -> bool:
                t0 = time.perf_counter()
                if script:
                    r = await sb.exec(cid, script, timeout=60)
                    if r.timed_out:
                        sub.append({"step": name, "ok": False, "detail": "команда не завершилась", "duration_ms": 0})
                        return False
                    if expect_pass:
                        try:
                            await sb.wait_ready(cid, 25)
                        except Exception as exc:  # checks below report what is broken
                            log.debug("environment not ready after fix: %s", exc)
                res = await run_checks(spec, ctx)
                ok = all_passed(res) if expect_pass else any_failed(res)
                failed = [r.id for r in res if not r.passed]
                sub.append(
                    {
                        "step": name,
                        "ok": ok,
                        "detail": ("все проверки пройдены" if not failed else "не пройдены: " + ", ".join(failed)),
                        "duration_ms": int((time.perf_counter() - t0) * 1000),
                    }
                )
                return ok

            fault = spec.faults.catalog[spec.chosen.get("initial_fault") or spec.faults.initial[0]]
            ok = await phase("clean_environment", None, True)
            ok = await phase("fault_breaks_checks", fault.apply, False) and ok
            ok = await phase("fix_restores_checks", fault.fix, True) and ok
            for inc in spec.incidents:
                f = spec.faults.catalog[inc.fault or ""]
                ok = await phase(f"incident:{inc.id}:breaks", f.apply, False) and ok
                ok = await phase(f"incident:{inc.id}:fix", f.fix, True) and ok
        finally:
            await sb.remove(cid)
        return ok, "путь решения подтверждён прогоном" if ok else "путь решения не подтверждён прогоном", sub

    # ---------------- routing
    @staticmethod
    def _after_static(s: State) -> str:
        return "reject" if s.get("status") == "rejected" else "dedup"

    @staticmethod
    def _after_dedup(s: State) -> str:
        if s.get("similarity", 0.0) >= DEDUP_THRESHOLD and s.get("attempt", 0) <= MAX_REGEN:
            return "select_params"
        return "dynamic_validate"

    async def reject(self, s: State) -> State:
        return {"status": "rejected"}

    def _build(self) -> Any:
        g: Any = StateGraph(State)
        g.add_node("select_params", self.select_params)
        g.add_node("generate_legend", self.generate_legend)
        g.add_node("assemble_spec", self.assemble_spec)
        g.add_node("static_validate", self.static_validate)
        g.add_node("dedup", self.dedup)
        g.add_node("dynamic_validate", self.dynamic_validate)
        g.add_node("reject", self.reject)
        g.add_edge(START, "select_params")
        g.add_edge("select_params", "generate_legend")
        g.add_edge("generate_legend", "assemble_spec")
        g.add_edge("assemble_spec", "static_validate")
        g.add_conditional_edges("static_validate", self._after_static, ["reject", "dedup"])
        g.add_conditional_edges("dedup", self._after_dedup, ["select_params", "dynamic_validate"])
        g.add_edge("dynamic_validate", END)
        g.add_edge("reject", END)
        return g.compile()

    async def run(
        self,
        *,
        template_id: uuid.UUID,
        template_code: str,
        base: dict[str, Any],
        user_id: uuid.UUID | None,
        seed: int | None = None,
    ) -> State:
        init: State = {
            "template_id": str(template_id),
            "template_code": template_code,
            "user_id": str(user_id) if user_id else None,
            "base": base,
            "seed": seed if seed is not None else random.SystemRandom().randrange(1 << 30),
            "attempt": 0,
            "steps": [],
            "errors": [],
        }
        out: State = await self.graph.ainvoke(init, {"recursion_limit": 40})
        return out
