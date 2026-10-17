import asyncio
import json
from datetime import timedelta

import pytest
import websockets
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import SecurityEvent
from app.events.models import EnvironmentEvent
from app.sandbox.manager import SandboxManager
from app.sessions import jobs
from app.sessions.models import LearningSession
from app.sessions.service import now_utc

pytestmark = [pytest.mark.docker, pytest.mark.db]


async def _session(client: AsyncClient, headers: dict[str, str]) -> dict:
    items = (await client.get("/api/scenarios/templates", headers=headers)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == "devops.web_recovery")
    run = (await client.post("/api/scenarios/generate", headers=headers, json={"template_id": tid})).json()["data"]
    r = await client.post("/api/sessions", headers=headers, json={"run_id": run["run_id"]})
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def _read_until(ws: websockets.ClientConnection, needle: str, timeout: float = 10) -> str:
    buf = ""
    async with asyncio.timeout(timeout):
        while needle not in buf:
            m = await ws.recv()
            buf += m.decode("utf-8", "replace") if isinstance(m, bytes) else m
    return buf


async def test_terminal_commands_incident_cleanup(
    client: AsyncClient,
    seeded: None,
    as_student: dict[str, str],
    db: AsyncSession,
    real_sandbox: SandboxManager,
    live_server: str,
) -> None:
    s = await _session(client, as_student)
    assert s["status"] == "active"
    row = await db.get(LearningSession, s["id"])
    await db.refresh(row)
    cid = row.sandbox_container_id
    # initial fault applied: the shop is down
    res = await real_sandbox.exec(cid, "curl -s -o /dev/null -w '%{http_code}' localhost:8080/health")
    assert res.output.strip() != "200"
    tok = (await client.post(f"/api/sessions/{s['id']}/ws-token", headers=as_student)).json()["data"]["token"]
    async with websockets.connect(f"ws://{live_server}/ws/sessions/{s['id']}/terminal?token={tok}") as ws:
        await ws.send(json.dumps({"type": "resize", "cols": 120, "rows": 30}))
        await ws.send(b"echo hi-$((40+2))\n")
        out = await _read_until(ws, "hi-42")
        assert "hi-42" in out
        # attack attempts from spec §12 «Безопасность sandbox»: all fail inside the container
        for cmd in ("sudo -i", "cat /var/run/docker.sock", "nmap -sS 10.0.0.0/24", "touch /etc/pwned"):
            await ws.send(cmd.encode() + b"\n")
        await ws.send(b"echo done-$((1+1))\n")
        await _read_until(ws, "done-2")
    assert not (await real_sandbox.exec(cid, "test -e /etc/pwned")).ok
    await jobs.commands_job(now_utc())
    evs = (await db.scalars(select(EnvironmentEvent).where(EnvironmentEvent.session_id == row.id))).all()
    cmds = [e.payload.get("cmd") for e in evs if e.type == "command"]
    assert "echo hi-$((40+2))" in cmds
    kinds = {e.payload.get("kind") for e in evs if e.type == "security"}
    assert kinds == {"privilege_escalation", "sandbox_escape", "network_scan", "forbidden_file"}
    sec = (await db.scalars(select(SecurityEvent).where(SecurityEvent.session_id == row.id))).all()
    assert {e.kind for e in sec} == kinds
    # incident at due time breaks the proxy; the event is stored for the digital footprint and WS
    await jobs.incidents_job(now_utc() + timedelta(minutes=6))
    conf = await real_sandbox.exec(cid, "grep -c 'server 127.0.0.1:8001;' /srv/nginx/store.conf")
    assert conf.output.strip() == "1"
    await db.refresh(row)
    assert row.incident_applied_at is not None
    inc = await db.scalars(
        select(EnvironmentEvent).where(EnvironmentEvent.session_id == row.id, EnvironmentEvent.type == "incident")
    )
    assert inc.first() is not None


async def test_foreign_student_cannot_open_terminal(
    client: AsyncClient, seeded: None, as_student: dict[str, str], real_sandbox: SandboxManager, live_server: str
) -> None:
    from tests.conftest import login

    s = await _session(client, as_student)
    other = await login(client, "petrova.md@masso.local")
    assert (await client.post(f"/api/sessions/{s['id']}/ws-token", headers=other)).status_code == 403
    with pytest.raises(websockets.exceptions.InvalidStatus):
        async with websockets.connect(f"ws://{live_server}/ws/sessions/{s['id']}/terminal?token=forged") as ws:
            await ws.recv()
    await jobs.reaper_job(now_utc())  # active session: container kept
    assert await real_sandbox.list_by_label(f"masso.session={s['id']}")


async def test_one_training_server_per_student(
    client: AsyncClient, seeded: None, as_student: dict[str, str], real_sandbox: SandboxManager
) -> None:
    items = (await client.get("/api/scenarios/templates", headers=as_student)).json()["data"]
    tid = next(t["id"] for t in items if t["code"] == "devops.web_recovery")
    # parallel generations of one student: the second one is refused while the first validates
    gens = await asyncio.gather(
        *(client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid}) for _ in range(2))
    )
    codes = sorted(r.status_code for r in gens)
    assert codes == [201, 503], [r.text for r in gens]
    run = next(r for r in gens if r.status_code == 201).json()["data"]
    first = await client.post("/api/sessions", headers=as_student, json={"run_id": run["run_id"]})
    assert first.status_code == 201
    run2 = (await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})).json()["data"]
    second = await client.post("/api/sessions", headers=as_student, json={"run_id": run2["run_id"]})
    assert second.status_code == 409 and second.json()["error"]["code"] == "SESSION_NOT_READY"


async def test_disk_quota_ends_session_and_log_tampering_recorded(
    client: AsyncClient, seeded: None, as_student: dict[str, str], db: AsyncSession, real_sandbox: SandboxManager
) -> None:
    from app.assessment_agent import jobs as a_jobs
    from app.audit.models import SecurityEvent
    from app.sandbox.models import SandboxProfile

    s = await _session(client, as_student)
    row = await db.get(LearningSession, s["id"])
    await db.refresh(row)
    cid = row.sandbox_container_id
    await real_sandbox.exec(cid, "echo '1700000000\t/srv\tls' >> /tmp/.masso/cmd.log")
    await jobs.commands_job(now_utc())
    await real_sandbox.exec(cid, ": > /tmp/.masso/cmd.log")  # the student wipes the trail
    await jobs.commands_job(now_utc())
    kinds = set((await db.scalars(select(SecurityEvent.kind).where(SecurityEvent.session_id == row.id))).all())
    assert "log_tampering" in kinds
    # a 60 KB line without a newline must not stall the collection: the next command is still recorded
    await real_sandbox.exec(cid, "head -c 60000 /dev/zero | tr '\\0' x >> /tmp/.masso/cmd.log")
    await real_sandbox.exec(cid, "printf '1700000000\\t/srv\\tnmap -sS 10.0.0.0/24\\n' >> /tmp/.masso/cmd.log")
    for _ in range(4):
        await jobs.commands_job(now_utc())
    kinds = set((await db.scalars(select(SecurityEvent.kind).where(SecurityEvent.session_id == row.id))).all())
    assert "network_scan" in kinds
    # a FIFO in place of the log must neither hang the worker nor be reported on every tick
    await real_sandbox.exec(cid, "rm -f /tmp/.masso/cmd.log && mkfifo /tmp/.masso/cmd.log")
    t0 = asyncio.get_running_loop().time()
    for _ in range(3):
        await jobs.commands_job(now_utc())
    assert asyncio.get_running_loop().time() - t0 < 10
    n = await db.scalar(
        select(func.count())
        .select_from(SecurityEvent)
        .where(SecurityEvent.session_id == row.id, SecurityEvent.kind == "log_tampering")
    )
    assert n == 2  # the truncation above and the FIFO once
    await real_sandbox.exec(cid, "rm -f /tmp/.masso/cmd.log")
    # a flooded log (sparse 5 MB) is skipped to its tail: the command written after it is still seen
    await real_sandbox.exec(
        cid, "truncate -s 5M /tmp/.masso/cmd.log && printf '1700000000\\t/srv\\tsudo -i\\n' >> /tmp/.masso/cmd.log"
    )
    for _ in range(3):
        await jobs.commands_job(now_utc())
    kinds = set((await db.scalars(select(SecurityEvent.kind).where(SecurityEvent.session_id == row.id))).all())
    assert "privilege_escalation" in kinds
    # the student fills /srv beyond the profile quota: the worker ends the session and removes the server
    prof = await db.get(SandboxProfile, "small")
    prof.storage_mb = 60
    await db.commit()
    # hidden from the student's own `du` by chmod 000: the daemon still sees it
    await real_sandbox.exec(
        cid, "mkdir /srv/h && head -c 80M /dev/zero > /srv/h/fill.bin && chmod 000 /srv/h", timeout=60
    )
    a_jobs._last_quota = None
    await a_jobs.quota_job(now_utc())
    await db.refresh(row)
    assert row.status == "completed"
    kinds = set((await db.scalars(select(SecurityEvent.kind).where(SecurityEvent.session_id == row.id))).all())
    assert "sandbox_quota" in kinds
    assert not await real_sandbox.list_by_label(f"masso.session={s['id']}")
