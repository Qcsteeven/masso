from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from tests.conftest import login

pytestmark = pytest.mark.db


async def test_admin_endpoints(client: AsyncClient, seeded: None, as_admin: dict[str, str]) -> None:
    ops = await login(client, "ops@masso.local")
    r = await client.get("/api/admin/sandbox/profiles", headers=ops)
    assert {p["code"] for p in r.json()["data"]} == {"small", "medium", "document"}
    r = await client.patch("/api/admin/sandbox/profiles/small", headers=as_admin, json={"pids_limit": 160})
    assert r.json()["data"]["pids_limit"] == 160
    assert (await client.patch("/api/admin/sandbox/profiles/small", headers=ops, json={"cpu": 2})).status_code == 403
    assert (await client.get("/api/admin/audit", headers=ops)).json()["error"]["code"] == "REPORT_PERIOD_REQUIRED"
    now = datetime.now(UTC)
    p = {"from": (now - timedelta(hours=1)).isoformat(), "to": (now + timedelta(hours=1)).isoformat()}
    audit = (await client.get("/api/admin/audit", headers=ops, params=p)).json()["data"]
    assert any(a["action"] == "sandbox.profile" for a in audit)
    await client.post("/api/auth/login", json={"email": "admin@masso.local", "password": "bad"})
    sec = (await client.get("/api/admin/security-events", headers=ops, params=p)).json()["data"]
    assert any(e["kind"] == "login_failed" for e in sec)
    csv = await client.get("/api/admin/logs/export", headers=ops, params={**p, "log": "audit"})
    assert csv.status_code == 200 and "Действие" in csv.text
    h = (await client.get("/api/admin/health", headers=ops)).json()["data"]
    assert h["components"]["postgresql"]["ok"] and "capacity" in h
    bg = (await client.get("/api/admin/background", headers=ops)).json()["data"]
    assert bg["incidents_pending"] == 0
    student = await login(client, "demonov.la@masso.local")
    assert (await client.get("/api/admin/health", headers=student)).status_code == 403
    teacher = await login(client, "teacher@masso.local")
    assert (await client.get("/api/reports/groups/list", headers=teacher)).json()["data"] == ["ИСИб-23-1"]
