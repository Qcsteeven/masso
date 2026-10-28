import copy
import json
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm_gateway.gateway import LLMGateway
from app.sandbox.manager import SandboxManager
from app.scenario_agent.graph import ScenarioAgent
from tests.conftest import SEED

pytestmark = [pytest.mark.docker, pytest.mark.db]


async def test_generate_web_recovery_validated_by_run(
    client: AsyncClient, seeded: None, as_student: dict[str, str], real_sandbox: SandboxManager
) -> None:
    items = (await client.get("/api/scenarios/templates", headers=as_student)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == "devops.web_recovery")
    t0 = time.monotonic()
    r = await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})
    elapsed = time.monotonic() - t0
    assert r.status_code == 201, r.text
    assert elapsed < 120, elapsed
    # staff view shows the validation report
    from tests.conftest import login

    staff = await login(client, "methodist@masso.local")
    run = (await client.get(f"/api/scenarios/runs/{r.json()['data']['run_id']}", headers=staff)).json()["data"]
    steps = {s["step"]: s["ok"] for s in run["validation_report"]["steps"]}
    for name in ("clean_environment", "fault_breaks_checks", "fix_restores_checks"):
        assert steps.get(name) is True, run["validation_report"]["steps"]
    incident_steps = [k for k in steps if k.startswith("incident:")]
    assert len(incident_steps) in (2, 4)  # 1–2 incidents from the pool, each «breaks» and «fix»
    assert all(steps[k] for k in incident_steps), run["validation_report"]["steps"]
    assert not await real_sandbox.list_by_label("masso.kind=validation")


async def test_unfixable_fault_rejected(db: AsyncSession, seeded: None, real_sandbox: SandboxManager) -> None:
    base = json.loads((SEED / "templates" / "web_recovery.json").read_text("utf-8"))
    broken = copy.deepcopy(base)
    for f in broken["faults"]["catalog"].values():
        f["fix"] = "true"  # the "reference fix" does not fix anything
    agent = ScenarioAgent(db, LLMGateway(db), real_sandbox)
    state = await agent.run(template_id=uuid.uuid4(), template_code="x", base=broken, user_id=None, seed=1)
    assert state["status"] == "rejected"
    assert any(s["step"] == "fix_restores_checks" and not s["ok"] for s in state["steps"])


async def test_every_incident_of_the_pool_is_validated_by_run(
    db: AsyncSession, seeded: None, real_sandbox: SandboxManager
) -> None:
    """All incidents of web_recovery at once: each must break the checks and its fix must restore them."""
    base = json.loads((SEED / "templates" / "web_recovery.json").read_text("utf-8"))
    base["incidents_pick"] = None  # take the whole pool
    agent = ScenarioAgent(db, LLMGateway(db), real_sandbox)
    state = await agent.run(template_id=uuid.uuid4(), template_code="x", base=base, user_id=None, seed=3)
    steps = {s["step"]: s for s in state["steps"]}
    for inc in base["incidents"]:
        for phase in ("breaks", "fix"):
            assert steps[f"incident:{inc['id']}:{phase}"]["ok"], steps[f"incident:{inc['id']}:{phase}"]
    assert state["status"] == "published", state["steps"]
