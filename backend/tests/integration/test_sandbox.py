import time
import uuid

import aiodocker
import pytest

from app.sandbox.manager import SandboxManager
from tests.integration.conftest import PROFILE

pytestmark = pytest.mark.docker


async def test_start_under_10s_and_health(manager: SandboxManager) -> None:
    t0 = time.monotonic()
    cid = await manager.create(uuid.uuid4().hex, "u", PROFILE, kind="test")
    elapsed = time.monotonic() - t0
    try:
        assert elapsed < 10, elapsed
        res = await manager.exec(cid, "curl -s -o /dev/null -w '%{http_code}' localhost:8080/health")
        assert res.output.strip() == "200"
        st = await manager.state(cid)
        assert st["running"] and st["restart_count"] == 0
    finally:
        await manager.remove(cid)


async def test_security_properties(manager: SandboxManager, container: str) -> None:
    assert (await manager.exec(container, "id -u")).output.strip() == "1000"
    assert not (await manager.exec(container, "touch /etc/pwned")).ok
    assert not (await manager.exec(container, "test -e /var/run/docker.sock")).ok
    assert not (await manager.exec(container, "curl -s -m 3 http://1.1.1.1")).ok
    assert not (await manager.exec(container, "sudo -n true")).ok
    caps = (await manager.exec(container, "grep -E 'CapEff|NoNewPrivs' /proc/self/status")).output
    assert "0000000000000000" in caps and "NoNewPrivs:\t1" in caps
    # /srv is writable for the student
    assert (await manager.exec(container, "echo ok > /srv/app/probe && cat /srv/app/probe")).output.strip() == "ok"
    info = await manager.inspect(container)
    hc = info["HostConfig"]
    assert hc["Privileged"] is False and hc["ReadonlyRootfs"] is True and hc["NetworkMode"] == "none"
    assert hc["CapDrop"] == ["ALL"] and "no-new-privileges" in hc["SecurityOpt"]
    assert not any("docker.sock" in b for b in (hc.get("Binds") or []))


async def test_pids_limit_stops_fork_bomb(manager: SandboxManager, container: str) -> None:
    res = await manager.exec(container, "for i in $(seq 1 400); do sleep 30 & done; echo spawned", timeout=20)
    assert "Resource temporarily unavailable" in res.output or "fork" in res.output.lower()
    await manager.exec(container, "pkill -u student sleep || true")
    # the server survives
    assert (await manager.exec(container, "supervisorctl status nginx")).output.split()[1] == "RUNNING"


async def test_remove_drops_volume(manager: SandboxManager) -> None:
    cid = await manager.create(uuid.uuid4().hex, "u", PROFILE, kind="test")
    info = await manager.inspect(cid)
    volumes = [m["Name"] for m in info["Mounts"] if m["Destination"] == "/srv"]
    assert volumes
    await manager.remove(cid)
    async with aiodocker.Docker() as d:
        with pytest.raises(aiodocker.DockerError):
            await d.volumes.get(volumes[0])
