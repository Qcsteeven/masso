"""Code scenarios (Д-44): generation, public part, runs of the student's code, submit with hidden checks."""

import json
from collections.abc import Iterator

import pytest
from httpx import AsyncClient

from app.coderun import tasks
from app.coderun.runner import CodeRunner, set_code_runner

pytestmark = pytest.mark.db


@pytest.fixture(autouse=True)
def local_runner() -> Iterator[None]:
    set_code_runner(CodeRunner(local=True))  # no Docker in API tests: the same contract in a temp dir
    yield
    set_code_runner(None)


async def _start(client: AsyncClient, headers: dict[str, str], code: str) -> dict:
    items = (await client.get("/api/scenarios/templates", headers=headers)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == code)
    gen = await client.post("/api/scenarios/generate", headers=headers, json={"template_id": tid})
    assert gen.status_code == 201, gen.text
    assert gen.json()["data"]["status"] == "published", gen.text
    r = await client.post("/api/sessions", headers=headers, json={"run_id": gen.json()["data"]["run_id"]})
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def test_code_session_end_to_end(client: AsyncClient, seeded: None, as_student: dict[str, str], db) -> None:
    s = await _start(client, as_student, "alg.binary_search")
    sc = s["scenario"]
    assert s["kind"] == "code" and sc["coding"]["func"] and sc["coding"]["statement"]
    assert set(sc["coding"]["files"]) == {"solution.py", "test_solution.py"}
    assert s["answers"]["files"] == sc["coding"]["files"]  # the workspace starts from the skeleton
    raw = json.dumps(s, ensure_ascii=False)
    for secret in ("hidden", "recipe", "make_cases", "mutant", "lo, hi = 0, len(ids)"):
        assert secret not in raw, secret
    func = sc["coding"]["func"]
    task = {"func": func}

    # run the skeleton: examples and the student's tests report failures, nothing is scored
    run = await client.post(f"/api/sessions/{s['id']}/run", headers=as_student, json={"files": sc["coding"]["files"]})
    assert run.status_code == 200, run.text
    out = run.json()["data"]
    assert [e["ok"] for e in out["examples"]] == [False, True]
    assert out["tests"]["total"] == 1 and out["tests"]["failures"]
    again = await client.post(f"/api/sessions/{s['id']}/run", headers=as_student, json={"files": sc["coding"]["files"]})
    assert again.status_code == 422 and "retry_after_sec" in again.json()["error"]["details"]

    bad = await client.post(
        f"/api/sessions/{s['id']}/answers", headers=as_student, json={"answers": {"files": {"../x.py": "1"}}}
    )
    assert bad.status_code == 422
    files = {
        "solution.py": tasks.reference_source("alg_binary_search", task),
        "test_solution.py": tasks.reference_tests("alg_binary_search", task),
    }
    r = await client.post(f"/api/sessions/{s['id']}/answers", headers=as_student, json={"answers": {"files": files}})
    assert r.status_code == 200, r.text
    rep = (await client.post(f"/api/sessions/{s['id']}/submit", headers=as_student)).json()["data"]
    assert rep["score"]["final"] == 100, rep
