"""Code checks (Д-44): hidden cases compared with the reference, and the student's own tests against mutants."""

import hashlib
import json
from typing import Any

from app.coderun import tasks
from app.coderun.runner import Box
from app.coderun.scripts import CASES, TESTS
from app.scenarios.spec import CodeSpec

TESTS_TIMEOUT = 10.0


def same(a: Any, b: Any) -> bool:
    """JSON values equal with strict bool/number distinction (1 is not True)."""
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b, strict=True))
    return bool(a == b)


def group_inputs(spec: CodeSpec, group: str) -> list[list[Any]] | dict[str, Any]:
    if group == "examples":
        return [e.args for e in spec.examples]
    data: list[list[Any]] | dict[str, Any] = spec.hidden.get(group, [])
    return data


def expected_outputs(spec: CodeSpec, group: str) -> list[Any]:
    if group == "examples":
        return [e.expected for e in spec.examples]
    ref = tasks.load_function(tasks.reference_source(spec.builder, spec.task), spec.func)
    inputs = group_inputs(spec, group)
    if isinstance(
        inputs, dict
    ):  # big generated inputs share objects between calls: never copied (the reference is pure)
        inputs = tasks.load_function(inputs["recipe"], "make_cases")(**inputs.get("kwargs", {}))
        return [json.loads(json.dumps(ref(*args), default=list)) for args in inputs]
    return [json.loads(json.dumps(ref(*json.loads(json.dumps(args))), default=list)) for args in inputs]


async def run_cases(box: Box, spec: CodeSpec, solution: str, group: str, time_limit: float) -> dict[str, Any]:
    """Outputs of `solution` on a group vs the reference: {passed, total, correct, timed_out, error, results}."""
    await box.write({"solution.py": solution})
    inputs = group_inputs(spec, group)
    digest = isinstance(
        inputs, dict
    )  # generated big groups: compare digests, outputs would exceed the exec output limit
    out = await box.python(CASES, {"func": spec.func, "cases": inputs, "digest": digest}, timeout=time_limit)
    expected = expected_outputs(spec, group)
    res: dict[str, Any] = {
        "total": len(expected),
        "correct": 0,
        "timed_out": out.timed_out,
        "error": None,
        "stdout": out.stdout,
    }
    if out.timed_out:
        res["error"] = f"превышено ограничение времени ({time_limit:g} с)"
    elif not out.ok:
        res["error"] = "решение не запустилось" + (f": {out.stdout[-300:]}" if out.stdout else "")
    elif out.result.get("import_error"):
        res["error"] = f"решение не загружается: {out.result['import_error']}"
    elif digest:
        canon = json.dumps(expected, ensure_ascii=False, separators=(",", ":"))
        match = out.result.get("digest") == hashlib.sha256(canon.encode()).hexdigest()
        res["correct"] = res["total"] if match else 0
        if not match:
            first = out.result.get("first_error")
            res["error"] = (
                f"ошибка на больших данных: {first}" if first else "ответы на больших данных не совпадают с ожидаемыми"
            )
    else:
        got, errors = out.result.get("outputs", []), out.result.get("errors", [])
        res["results"] = [
            {"got": g, "error": e, "ok": e is None and same(g, x)}
            for g, e, x in zip(got, errors, expected, strict=False)
        ]
        res["correct"] = sum(1 for r in res["results"] if r["ok"])
    res["passed"] = res["error"] is None and res["correct"] == res["total"]
    return res


async def run_student_tests(box: Box, tests: str, solution: str) -> dict[str, Any]:
    await box.write({"test_solution.py": tests, "solution.py": solution})
    out = await box.python(TESTS, None, timeout=TESTS_TIMEOUT)
    res = dict(out.result) if out.ok else {"total": 0, "passed": 0, "failures": [], "import_error": None}
    res["timed_out"], res["stdout"] = out.timed_out, out.stdout
    if out.timed_out:
        res["import_error"] = f"тесты не завершились за {TESTS_TIMEOUT:g} с"
    elif not out.ok and not res.get("import_error"):
        res["import_error"] = "тесты не запустились" + (f": {out.stdout[-300:]}" if out.stdout else "")
    return res


async def check_cases(
    box: Box, spec: CodeSpec, files: dict[str, str], group: str, time_limit: float
) -> tuple[bool, str]:
    r = await run_cases(box, spec, files.get("solution.py", ""), group, time_limit)
    if r["error"]:
        return False, str(r["error"])[:400]
    return bool(r["passed"]), f"верно {r['correct']} из {r['total']}"


async def check_student_tests(box: Box, spec: CodeSpec, files: dict[str, str], min_killed: int) -> tuple[bool, str]:
    tests = files.get("test_solution.py", "")
    ref = await run_student_tests(box, tests, tasks.reference_source(spec.builder, spec.task))
    if ref.get("import_error"):
        return False, f"тесты не запускаются: {ref['import_error']}"[:400]
    if not ref.get("total"):
        return False, "тестов не найдено: нужны функции test_... с assert"
    if ref.get("failures"):
        f = ref["failures"][0]
        return False, f"тест {f['name']} не проходит на правильном решении: {f['error']}"[:400]
    mutants = tasks.mutant_sources(spec.builder, spec.task)
    killed = 0
    for m in mutants:
        r = await run_student_tests(box, tests, m)
        if r.get("import_error") or r.get("failures"):
            killed += 1
    return killed >= min_killed, f"тесты находят {killed} из {len(mutants)} типичных ошибок (нужно {min_killed})"
