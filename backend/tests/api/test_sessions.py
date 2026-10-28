import json
from datetime import timedelta

import pytest
import websockets
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.sessions import jobs
from app.sessions.models import LearningSession
from app.sessions.service import now_utc
from tests.conftest import login

pytestmark = pytest.mark.db


async def _start_doc(client: AsyncClient, headers: dict[str, str], code: str) -> dict:
    items = (await client.get("/api/scenarios/templates", headers=headers)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == code)
    run = (await client.post("/api/scenarios/generate", headers=headers, json={"template_id": tid})).json()["data"]
    r = await client.post("/api/sessions", headers=headers, json={"run_id": run["run_id"]})
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def test_document_session_lifecycle(
    client: AsyncClient, seeded: None, as_student: dict[str, str], db: AsyncSession
) -> None:
    s = await _start_doc(client, as_student, "legal.supply_contract")
    assert s["status"] == "active" and s["kind"] == "document"
    assert {d["id"] for d in s["scenario"]["documents"]} == {"contract", "specification", "regulation"}
    assert "answer_key" not in json.dumps(s, ensure_ascii=False)
    # idempotent start returns the same session
    again = await client.post("/api/sessions", headers=as_student, json={"run_id": s["run_id"]})
    assert again.json()["data"]["id"] == s["id"]
    r = await client.post(
        f"/api/sessions/{s['id']}/answers",
        headers=as_student,
        json={"answers": {"findings": [{"section": "2", "defect_type": "total_sum_mismatch"}]}},
    )
    assert r.status_code == 200
    # incident is due within 5 minutes
    row = await db.get(LearningSession, s["id"])
    await db.refresh(row)
    assert row.incident_due_at is not None and row.incident_due_at - row.started_at <= timedelta(minutes=5)
    await jobs.incidents_job(now_utc() + timedelta(minutes=6))
    view = (await client.get(f"/api/sessions/{s['id']}", headers=as_student)).json()["data"]
    assert any(e["type"] == "incident" for e in view["events"])
    reg = next(d for d in view["scenario"]["documents"] if d["id"] == "regulation")
    assert "перенумерованы" in reg["markdown"]
    assert view["answers"]["findings"][0]["defect_type"] == "total_sum_mismatch"


async def test_idle_pause_and_resume(
    client: AsyncClient, seeded: None, as_student: dict[str, str], db: AsyncSession
) -> None:
    s = await _start_doc(client, as_student, "audit.invoice_reconciliation")
    await jobs.idle_job(now_utc() + timedelta(minutes=16))
    view = (await client.get(f"/api/sessions/{s['id']}", headers=as_student)).json()["data"]
    assert view["status"] == "paused"
    # any action resumes
    await client.post(f"/api/sessions/{s['id']}/answers", headers=as_student, json={"answers": {"correct_sum": 1}})
    view = (await client.get(f"/api/sessions/{s['id']}", headers=as_student)).json()["data"]
    assert view["status"] == "active"
    await jobs.idle_job(now_utc() + timedelta(hours=25))
    row = (await db.scalars(select(LearningSession).where(LearningSession.id == s["id"]))).one()
    await db.refresh(row)
    assert row.status == "expired"


async def test_foreign_student_forbidden(client: AsyncClient, seeded: None, as_student: dict[str, str]) -> None:
    s = await _start_doc(client, as_student, "audit.invoice_reconciliation")
    other = await login(client, "petrova.md@masso.local")
    assert (await client.get(f"/api/sessions/{s['id']}", headers=other)).status_code == 403
    assert (await client.post(f"/api/sessions/{s['id']}/ws-token", headers=other)).status_code == 403
    teacher = await login(client, "teacher@masso.local")
    assert (await client.get(f"/api/sessions/{s['id']}", headers=teacher)).status_code == 200


async def test_ws_events_auth_and_push(
    client: AsyncClient, seeded: None, as_student: dict[str, str], live_server: str
) -> None:
    s = await _start_doc(client, as_student, "legal.supply_contract")
    tok = (await client.post(f"/api/sessions/{s['id']}/ws-token", headers=as_student)).json()["data"]["token"]
    other = await login(client, "petrova.md@masso.local")
    s2 = await _start_doc(client, other, "audit.invoice_reconciliation")
    tok_other = (await client.post(f"/api/sessions/{s2['id']}/ws-token", headers=other)).json()["data"]["token"]
    # token of another session is rejected
    with pytest.raises(websockets.exceptions.InvalidStatus):
        async with websockets.connect(f"ws://{live_server}/ws/sessions/{s['id']}/events?token={tok_other}") as ws:
            await ws.recv()
    async with websockets.connect(f"ws://{live_server}/ws/sessions/{s['id']}/events?token={tok}") as ws:
        first = json.loads(await ws.recv())
        assert first["type"] == "status"
        await jobs.incidents_job(now_utc() + timedelta(minutes=6))
        msg = json.loads(await ws.recv())
        assert msg["type"] == "incident" and "регламент" in msg["payload"]["message"]


async def test_self_check_shows_criteria_without_penalty(
    client: AsyncClient, seeded: None, as_student: dict[str, str], db: AsyncSession
) -> None:
    from app.events.models import EnvironmentEvent

    s = await _start_doc(client, as_student, "audit.invoice_reconciliation")
    r = await client.post(f"/api/sessions/{s['id']}/self-check", headers=as_student)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert [c["title"] for c in data["results"]] == s["scenario"]["criteria"]
    assert all(set(c) == {"title", "passed", "skipped"} for c in data["results"])  # no check details or params
    assert data["passed"] < data["total"] and data["retry_after_sec"] == 30
    # throttled: one self-check per 30 s
    again = await client.post(f"/api/sessions/{s['id']}/self-check", headers=as_student)
    assert again.status_code == 422 and again.json()["error"]["code"] == "VALIDATION_ERROR"
    ev = (
        await db.scalars(
            select(EnvironmentEvent).where(EnvironmentEvent.session_id == s["id"], EnvironmentEvent.type == "check")
        )
    ).all()
    assert len(ev) == 1 and ev[0].payload["self_check"] is True
    other = await login(client, "petrova.md@masso.local")
    assert (await client.post(f"/api/sessions/{s['id']}/self-check", headers=other)).status_code == 403
    # submit still scores from scratch: the self-check costs nothing
    rep = (await client.post(f"/api/sessions/{s['id']}/submit", headers=as_student)).json()["data"]
    assert rep["score"]["hints"] == 0 and rep["score"]["violations"] == 0
