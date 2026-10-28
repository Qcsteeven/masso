import time
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.sandbox.manager import SandboxManager
from app.scenarios.models import ScenarioRun
from app.scenarios.spec import ContainerSpec, parse_spec
from app.sessions import jobs
from app.sessions.models import LearningSession
from app.sessions.service import now_utc

pytestmark = [pytest.mark.docker, pytest.mark.db]


async def test_devops_full_cycle(
    client: AsyncClient, seeded: None, as_student: dict[str, str], db: AsyncSession, real_sandbox: SandboxManager
) -> None:
    items = (await client.get("/api/scenarios/templates", headers=as_student)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == "devops.web_recovery")
    run = (await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})).json()["data"]
    s = (await client.post("/api/sessions", headers=as_student, json={"run_id": run["run_id"]})).json()["data"]
    row = await db.get(LearningSession, s["id"])
    await db.refresh(row)
    spec = parse_spec((await db.get(ScenarioRun, row.run_id)).generated_spec)
    assert isinstance(spec, ContainerSpec)
    cid = row.sandbox_container_id
    # self-check before the fix: the shop is down
    before = (await client.post(f"/api/sessions/{s['id']}/self-check", headers=as_student)).json()["data"]
    assert not next(c for c in before["results"] if c["title"].startswith("Магазин"))["passed"]
    # the student fixes the initial fault, then each incident of the variant (1–2 from the pool) arrives and is fixed
    await real_sandbox.exec(cid, spec.faults.catalog[spec.chosen["initial_fault"]].fix)
    assert 1 <= len(spec.incidents) <= 2
    for k, inc in enumerate(spec.incidents):
        await jobs.incidents_job(now_utc() + timedelta(minutes=6 * (k + 1)))
        await real_sandbox.exec(cid, spec.faults.catalog[inc.fault or ""].fix)
    await real_sandbox.wait_ready(cid, 20)
    t0 = time.monotonic()
    r = await client.post(f"/api/sessions/{s['id']}/submit", headers=as_student)
    assert r.status_code == 200, r.text
    assert time.monotonic() - t0 < 30
    res = r.json()["data"]
    assert res["score"]["final"] == 100, res
    assert not await real_sandbox.list_by_label(f"masso.session={s['id']}")  # cleaned up within the request
    rep = (await client.get(f"/api/reports/{res['report_id']}", headers=as_student)).json()["data"]
    assert len(rep["incidents"]) == len(spec.incidents) and rep["score"]["passed"]


async def test_devops_unfixed_fails(
    client: AsyncClient, seeded: None, as_student: dict[str, str], real_sandbox: SandboxManager
) -> None:
    items = (await client.get("/api/scenarios/templates", headers=as_student)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == "devops.web_recovery")
    run = (await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})).json()["data"]
    s = (await client.post("/api/sessions", headers=as_student, json={"run_id": run["run_id"]})).json()["data"]
    res = (await client.post(f"/api/sessions/{s['id']}/submit", headers=as_student)).json()["data"]
    assert not res["score"]["passed"] and res["score"]["critical_failed"]
