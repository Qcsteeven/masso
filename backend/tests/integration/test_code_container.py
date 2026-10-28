"""Code scenarios in real sandbox containers (Д-44): every variant is validated by run, student runs are isolated."""

import time

import pytest
from httpx import AsyncClient

from app.coderun import tasks
from app.sandbox.manager import SandboxManager

pytestmark = [pytest.mark.docker, pytest.mark.db]


@pytest.mark.parametrize("code", ["alg.binary_search", "alg.brackets", "alg.bfs"])
async def test_code_variant_validated_in_sandbox(
    client: AsyncClient, seeded: None, as_student: dict[str, str], real_sandbox: SandboxManager, code: str
) -> None:
    items = (await client.get("/api/scenarios/templates", headers=as_student)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == code)
    t0 = time.monotonic()
    r = await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})
    assert r.status_code == 201, r.text
    assert time.monotonic() - t0 < 120
    data = r.json()["data"]
    assert data["status"] == "published", data
    from tests.conftest import login

    staff = await login(client, "methodist@masso.local")
    run = (await client.get(f"/api/scenarios/runs/{data['run_id']}", headers=staff)).json()["data"]
    steps = {s["step"]: s["ok"] for s in run["validation_report"]["steps"]}
    assert steps["reference_solution"] and steps["skeleton_fails"], run["validation_report"]["steps"]
    assert steps["wrong_solution_1"] and steps["wrong_solution_2"]
    assert not await real_sandbox.list_by_label("masso.kind=validation")  # throwaway boxes are removed


async def test_student_run_and_submit_in_sandbox(
    client: AsyncClient, seeded: None, as_student: dict[str, str], real_sandbox: SandboxManager
) -> None:
    items = (await client.get("/api/scenarios/templates", headers=as_student)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == "alg.brackets")
    run_id = (await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})).json()[
        "data"
    ]["run_id"]
    s = (await client.post("/api/sessions", headers=as_student, json={"run_id": run_id})).json()["data"]
    coding = s["scenario"]["coding"]
    # the student's code cannot reach the network or write outside the task directory
    probe = coding["files"]["solution.py"] + (
        "\nimport socket, os\n"
        "try:\n    socket.create_connection(('1.1.1.1', 53), timeout=2); print('NET-OPEN')\nexcept OSError: print('NET-CLOSED')\n"
        "try:\n    open('/etc/pwned', 'w'); print('ETC-WRITABLE')\nexcept OSError: print('ETC-READONLY')\n"
        "print('USER', os.getuid())\n"
    )
    r = await client.post(
        f"/api/sessions/{s['id']}/run", headers=as_student, json={"files": {**coding["files"], "solution.py": probe}}
    )
    assert r.status_code == 200, r.text
    out = r.json()["data"]["stdout"]
    assert "NET-CLOSED" in out and "ETC-READONLY" in out and "USER 1000" in out, out
    task = {"func": coding["func"], "pairs": None}
    # the variant's bracket set is not public: take the reference through the run spec on the server side
    from sqlalchemy import select

    from app.db import get_sessionmaker
    from app.scenarios.models import ScenarioRun

    async with get_sessionmaker()() as db:
        spec = (await db.scalars(select(ScenarioRun.generated_spec).where(ScenarioRun.id == run_id))).one()
    task = spec["task"]
    files = {
        "solution.py": tasks.reference_source("alg_brackets", task),
        "test_solution.py": tasks.reference_tests("alg_brackets", task),
    }
    assert (
        await client.post(f"/api/sessions/{s['id']}/answers", headers=as_student, json={"answers": {"files": files}})
    ).status_code == 200
    rep = (await client.post(f"/api/sessions/{s['id']}/submit", headers=as_student)).json()["data"]
    assert rep["score"]["final"] == 100, rep
    assert not await real_sandbox.list_by_label("masso.kind=validation")
