"""Verification Engine (spec §4.1): runs scenario checks and returns pass/fail per check.

Container checks run inside the session container as `student` through the Sandbox Manager;
command text comes from the (hidden) spec and is passed via exec at run time, never stored in the image.
Document checks compare the submitted answer with the answer key.
"""

import re
import shlex
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.llm_gateway.providers import cosine
from app.scenarios.spec import Check, CodeSpec, ContainerSpec, DocumentSpec

SEMANTIC_THRESHOLD = 0.85
MAX_DETAIL = 500


class ExecLike(Protocol):
    async def exec(
        self,
        container_id: str,
        cmd: str | list[str],
        *,
        timeout: float = 30.0,
        user: str = "student",
        workdir: str = "/srv",
    ) -> Any: ...

    async def state(self, container_id: str) -> dict[str, Any]: ...


Embedder = Callable[[list[str]], Awaitable[tuple[list[list[float]], str]]]


@dataclass
class CheckResult:
    id: str
    title: str
    type: str
    weight: float
    critical: bool
    passed: bool
    detail: str = ""
    skipped: bool = False
    judge: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "weight": self.weight,
            "critical": self.critical,
            "passed": self.passed,
            "detail": self.detail[:MAX_DETAIL],
            "skipped": self.skipped,
            "judge": self.judge,
        }


@dataclass
class CheckContext:
    container_id: str | None = None
    sandbox: ExecLike | None = None
    answers: dict[str, Any] = field(default_factory=dict)
    applied_incidents: set[str] = field(default_factory=set)
    embed: Embedder | None = None
    code: CodeSpec | None = None  # code engine: the spec and an open throwaway sandbox (app.coderun)
    box: Any = None


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().replace("ё", "е")).strip()


_NUMBER = re.compile(r"\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?")


def _numbers(text: str) -> set[str]:
    """Distinct numbers of a text, normalised: `1 234 567,50` → `1234567.50`."""
    return {re.sub(r"\s", "", t).replace(",", ".") for t in _NUMBER.findall(text)}


def _has_number(found: set[str], expected: str) -> bool:
    exp = re.sub(r"\s", "", expected).replace(",", ".")
    # an integer expectation (whole roubles) also matches the same number written with kopecks
    return any(n == exp or ("." not in exp and n.split(".")[0] == exp) for n in found)


def _num(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(" ", "").replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def _find(answers: dict[str, Any], defect_type: str, section: str | None) -> dict[str, Any] | None:
    for f in answers.get("findings", []) or []:
        if not isinstance(f, dict):
            continue
        if f.get("defect_type") == defect_type and (not section or str(f.get("section", "")) == section):
            return f
    return None


async def _semantic(check: Check, text: str, ctx: CheckContext) -> tuple[bool, str, str]:
    ref = str(check.params.get("reference", ""))
    must = [_norm(m) for m in check.params.get("must_contain", [])]
    if not text.strip():
        return False, "ответ не заполнен", ""
    nums = _numbers(text)
    # numeric key values are compared as numbers, and a text listing many numbers does not match
    keywords_ok = (
        all((_has_number(nums, m) and len(nums) <= 3) if _NUMBER.fullmatch(m) else m in _norm(text) for m in must)
        if must
        else False
    )
    if ctx.embed is not None and ref:
        vecs, source = await ctx.embed([ref, text])
        if source != "hash":
            sim = cosine(vecs[0], vecs[1])
            return sim >= SEMANTIC_THRESHOLD or keywords_ok, f"сходство {sim:.2f}", "embeddings"
    # No semantic embeddings: key facts of the reference must be present.
    return keywords_ok, "проверка ключевых значений", "keywords"


async def run_check(check: Check, ctx: CheckContext) -> CheckResult:
    res = CheckResult(
        id=check.id, title=check.title, type=check.type, weight=check.weight, critical=check.critical, passed=False
    )
    p = check.params
    req = p.get("requires_incident")
    if req and req not in ctx.applied_incidents:
        res.skipped, res.passed, res.detail = True, True, "инцидент не наступил"
        return res
    if check.type in ("code_cases", "code_student_tests"):
        from app.coderun import checks as code_checks

        if ctx.code is None or ctx.box is None:
            res.detail = "среда выполнения кода недоступна"
            return res
        files = ctx.answers.get("files") or {}
        if check.type == "code_cases":
            res.passed, res.detail = await code_checks.check_cases(
                ctx.box, ctx.code, files, str(p.get("group", "basic")), float(p.get("time_limit", 10))
            )
        else:
            res.passed, res.detail = await code_checks.check_student_tests(
                ctx.box, ctx.code, files, int(p.get("min_killed", 2))
            )
        return res
    if check.type in ("http_health", "docker_exec", "file_diff", "docker_inspect"):
        if ctx.sandbox is None or ctx.container_id is None:
            res.detail = "учебная среда недоступна"
            return res
        sb, cid = ctx.sandbox, ctx.container_id
        if check.type == "http_health":
            url = str(p.get("url", "http://127.0.0.1:8080/health"))
            out = await sb.exec(
                cid, f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 5 {shlex.quote(url)}", timeout=15
            )
            code = out.output.strip()[-3:]
            res.passed = code == str(p.get("status", 200))
            res.detail = f"HTTP {code or '—'}"
        elif check.type == "docker_exec":
            out = await sb.exec(cid, str(p["cmd"]), timeout=float(p.get("timeout", 20)))
            ok = not out.timed_out
            if "exit_code" in p:
                ok = ok and out.exit_code == int(p["exit_code"])
            if p.get("expect_regex"):
                ok = ok and re.search(str(p["expect_regex"]), out.output) is not None
            if p.get("forbid_regex"):
                ok = ok and re.search(str(p["forbid_regex"]), out.output) is None
            if not any(k in p for k in ("exit_code", "expect_regex", "forbid_regex")):
                ok = ok and out.exit_code == 0
            res.passed, res.detail = ok, f"код {out.exit_code}: {out.output.strip()[-200:]}"
        elif check.type == "file_diff":
            out = await sb.exec(cid, f"cat {shlex.quote(str(p['path']))}", timeout=10)
            text = out.output
            ok = out.exit_code == 0
            for s in p.get("contains", []):
                ok = ok and s in text
            for s in p.get("not_contains", []):
                ok = ok and s not in text
            if "equals" in p:
                ok = ok and text.strip() == str(p["equals"]).strip()
            res.passed, res.detail = ok, "содержимое файла проверено"
        else:
            st = await sb.state(cid)
            ok = st.get("status") == p.get("state", "running") and not st.get("oom_killed")
            ok = ok and int(st.get("restart_count", 0)) <= int(p.get("max_restarts", 0))
            res.passed, res.detail = ok, f"состояние {st.get('status')}, перезапусков {st.get('restart_count', 0)}"
        return res

    a = ctx.answers
    if check.type == "rule_match":
        if "defect_type" in p:
            f = _find(a, str(p["defect_type"]), p.get("section"))
            must = [str(m) for m in p.get("must_contain", [])]
            if f is not None and must:
                # the finding must name the variant's concrete value (one memorised answer must not fit every
                # variant) and must not list many numbers at once (enumerating candidates is not an answer)
                limit = int(p.get("max_numbers", 3))
                nums = _numbers(f"{f.get('comment', '')} {f.get('proposed_text', '')}")  # both fields together
                f = f if len(nums) <= limit and all(_has_number(nums, m) for m in must) else None
            res.passed, res.detail = f is not None, "найдено" if f else "не найдено"
        else:
            got = str(a.get(str(p["field"]), ""))
            res.passed = got == str(p["expected"])
            res.detail = "совпадает" if res.passed else "не совпадает"
    elif check.type == "numeric_match":
        num = _num(a.get(str(p["field"])))
        exp = float(p["expected"])
        tol = float(p.get("tolerance", 0.01))
        if num is None:
            res.passed = False
        elif p.get("abs"):
            res.passed = abs(abs(num) - abs(exp)) <= tol
        else:
            res.passed = abs(num - exp) <= tol
        res.detail = "значение верно" if res.passed else "значение не совпадает"
    elif check.type == "semantic_similarity":
        if "defect_type" in p:
            f = _find(a, str(p["defect_type"]), p.get("section"))
            text = str(f.get("proposed_text", "")) if f else ""
        else:
            text = str(a.get(str(p.get("field", "")), ""))
        res.passed, res.detail, res.judge = await _semantic(check, text, ctx)
    return res


async def run_checks(spec: ContainerSpec | DocumentSpec, ctx: CheckContext) -> list[CheckResult]:
    if isinstance(spec, CodeSpec) and ctx.box is None:
        from app.coderun.runner import get_code_runner

        # one throwaway sandbox for all checks of a run; removed right after
        async with get_code_runner().box() as box:
            ctx.code, ctx.box = spec, box
            try:
                return [await run_check(c, ctx) for c in spec.checks]
            finally:
                ctx.box = None
    if isinstance(spec, CodeSpec):
        ctx.code = spec
    return [await run_check(c, ctx) for c in spec.checks]


def all_passed(results: list[CheckResult]) -> bool:
    return all(r.passed for r in results)


def any_failed(results: list[CheckResult]) -> bool:
    return any(not r.passed for r in results if not r.skipped)
