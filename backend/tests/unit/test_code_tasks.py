"""Algorithm tasks (Д-44) on the local runner: reference passes, typical mistakes are caught, the skeleton fails."""

import random

import pytest

from app.coderun import tasks
from app.coderun.checks import check_student_tests, run_cases, same
from app.coderun.runner import CodeRunner
from app.scenarios.spec import CodeSpec, parse_spec

BUILDERS = list(tasks.TASKS)


def _spec(builder: str, seed: int = 1) -> CodeSpec:
    v = tasks.TASKS[builder].build(random.Random(seed))
    spec = parse_spec(
        {
            "kind": "code",
            "code": f"alg.{builder}",
            "domain": "algorithms",
            "title": "t",
            "builder": builder,
            "target_skills": [{"skill": "X", "weight": 1}],
            "legend": {"template": "легенда задачи"},
            "hints": {"policy": "limited_3", "ladder": ["a", "b", "c"]},
            "func": v.func,
            "statement": v.statement,
            "files": v.files,
            "examples": [e.model_dump() for e in v.examples],
            "hidden": v.hidden,
            "task": v.task,
            "incidents": [i.model_dump() for i in v.incidents],
            "checks": [c.model_dump() for c in v.checks],
        }
    )
    assert isinstance(spec, CodeSpec)
    return spec


def test_same_is_strict_about_bools() -> None:
    assert same([1, [True]], [1, [True]])
    assert not same(1, True) and not same([0], [False])


@pytest.mark.parametrize("builder", BUILDERS)
async def test_reference_passes_every_group_and_wrong_solutions_fail(builder: str) -> None:
    spec = _spec(builder)
    groups = ["examples", *spec.hidden]
    async with CodeRunner(local=True).box() as box:
        ref = tasks.reference_source(builder, spec.task)
        for g in groups:
            r = await run_cases(box, spec, ref, g, 20)
            assert r["passed"], (g, r)
        skeleton = await run_cases(box, spec, spec.files["solution.py"], "basic", 10)
        assert not skeleton["passed"]
        for wrong in tasks.wrong_sources(builder, spec.task):
            caught = False
            for g in [*[x for x in groups if x != "perf"], "perf"]:  # cheap groups first, stop at the first failure
                if not (await run_cases(box, spec, wrong, g, 5)).get("passed"):
                    caught = True
                    break
            assert caught, wrong[:80]


@pytest.mark.parametrize("builder", BUILDERS)
async def test_reference_tests_catch_mutants_and_skeleton_tests_do_not(builder: str) -> None:
    spec = _spec(builder)
    async with CodeRunner(local=True).box() as box:
        good = {"test_solution.py": tasks.reference_tests(builder, spec.task)}
        ok, detail = await check_student_tests(box, spec, good, 2)
        assert ok, detail
        ok, detail = await check_student_tests(box, spec, {"test_solution.py": spec.files["test_solution.py"]}, 2)
        assert not ok and "тесты находят" in detail
        ok, detail = await check_student_tests(box, spec, {"test_solution.py": "x = 1\n"}, 2)
        assert not ok and "тестов не найдено" in detail


@pytest.mark.parametrize("builder", BUILDERS)
def test_variants_differ_and_public_parts_hold_no_reference(builder: str) -> None:
    a, b = _spec(builder, 1), _spec(builder, 2)
    assert a.hidden != b.hidden
    ref_lines = [
        ln.strip()
        for ln in tasks.reference_source(builder, a.task).splitlines()
        if len(ln.strip()) > 25 and not ln.strip().startswith("def ")
    ]
    public = a.statement + "".join(a.files.values())
    assert not any(ln in public for ln in ref_lines)
