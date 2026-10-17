"""Sandbox Manager (spec §7): training-server containers through the Docker Engine API.

Security flags are mandatory and applied together: user=student, cap_drop=ALL, no-new-privileges,
network none, read-only rootfs (writable /srv anonymous volume + tmpfs /tmp, /run), CPU/RAM/pids limits.
Never privileged, never the Docker socket inside, no published ports.
"""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import aiodocker
from aiodocker.containers import DockerContainer

from app.config import get_settings

log = logging.getLogger("masso.sandbox")

LABEL_SESSION = "masso.session"
LABEL_USER = "masso.user"
LABEL_KIND = "masso.kind"
LABEL_INSTANCE = "masso.instance"  # several installations may share one Docker daemon
MAX_OUTPUT = 64 * 1024
STUDENT = "student"


class SandboxError(Exception):
    pass


@dataclass(frozen=True)
class Profile:
    code: str
    image: str
    cpu: float
    mem_mb: int
    pids_limit: int
    storage_mb: int
    network_policy: str = "deny_all"


@dataclass(frozen=True)
class ExecResult:
    exit_code: int
    output: str
    duration_ms: int
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


def container_config(profile: Profile, labels: dict[str, str]) -> dict[str, Any]:
    """The full create-config. Kept as a pure function so tests can assert every security flag."""
    if profile.network_policy != "deny_all":
        raise SandboxError("Сетевые политики кроме deny_all относятся ко второй очереди.")
    return {
        "Image": profile.image,
        "User": STUDENT,
        "Labels": labels,
        "WorkingDir": "/srv",
        "Hostname": "masso-srv",
        "Env": ["TERM=xterm-256color", "LANG=C.UTF-8"],
        "NetworkDisabled": True,
        "HostConfig": {
            "NetworkMode": "none",
            "CapDrop": ["ALL"],
            "SecurityOpt": ["no-new-privileges"],
            "Privileged": False,
            "ReadonlyRootfs": True,
            "Tmpfs": {"/tmp": "rw,nosuid,nodev,size=64m", "/run": "rw,nosuid,nodev,size=8m"},  # noqa: S108
            "Memory": profile.mem_mb * 1024 * 1024,
            "MemorySwap": profile.mem_mb * 1024 * 1024,
            "NanoCpus": int(profile.cpu * 1_000_000_000),
            "PidsLimit": profile.pids_limit,
            "Init": True,
            "AutoRemove": False,
            "PortBindings": {},
            "Binds": [],
        },
        "Volumes": {"/srv": {}},
    }


class SandboxManager:
    def __init__(self, url: str | None = None, instance: str | None = None) -> None:
        self._url = url or get_settings().docker_url
        self.instance = instance or get_settings().instance_id
        self._docker: aiodocker.Docker | None = None

    @property
    def docker(self) -> aiodocker.Docker:
        if self._docker is None:
            self._docker = aiodocker.Docker(url=self._url)
        return self._docker

    async def close(self) -> None:
        if self._docker is not None:
            await self._docker.close()
            self._docker = None

    async def ping(self) -> dict[str, Any]:
        info = dict(await self.docker.system.info())
        return {
            "server_version": info.get("ServerVersion"),
            "containers_running": info.get("ContainersRunning"),
            "ncpu": info.get("NCPU"),
            "mem_total": info.get("MemTotal"),
        }

    async def create(
        self, session_id: str, user_id: str, profile: Profile, *, kind: str = "session", wait_ready: float = 60.0
    ) -> str:
        labels = {LABEL_SESSION: session_id, LABEL_USER: user_id, LABEL_KIND: kind, LABEL_INSTANCE: self.instance}
        try:
            container = await self.docker.containers.create(
                container_config(profile, labels), name=f"masso-{kind}-{session_id[:12]}"
            )
            await container.start()
        except aiodocker.DockerError as exc:
            raise SandboxError(f"Не удалось создать учебную среду: {exc.message}") from exc
        if wait_ready:
            await self.wait_ready(container.id, wait_ready)
        return str(container.id)

    async def wait_ready(self, container_id: str, timeout: float = 60.0) -> None:
        """Wait until every supervisord program is RUNNING."""
        deadline = time.monotonic() + timeout
        last = ""
        while time.monotonic() < deadline:
            res = await self.exec(container_id, "supervisorctl status", timeout=10)
            last = res.output
            lines = [ln for ln in res.output.splitlines() if ln.strip()]
            if lines and all("RUNNING" in ln.split() for ln in lines):
                return
            await asyncio.sleep(0.5)
        raise SandboxError(f"Учебная среда не запустилась за {int(timeout)} с: {last[-300:]}")

    async def _container(self, container_id: str) -> DockerContainer:
        return self.docker.containers.container(container_id)

    async def exec(
        self,
        container_id: str,
        cmd: str | list[str],
        *,
        timeout: float = 30.0,
        user: str = STUDENT,
        workdir: str = "/srv",
    ) -> ExecResult:
        """Run a command as `student` (never root) and return exit code and combined output."""
        argv = ["bash", "-lc", cmd] if isinstance(cmd, str) else cmd
        t0 = time.perf_counter()
        container = await self._container(container_id)
        try:
            exe = await container.exec(
                argv, stdout=True, stderr=True, user=user, workdir=workdir, environment={"LANG": "C.UTF-8"}
            )
            chunks: list[bytes] = []
            size = 0

            async def _read() -> None:
                nonlocal size
                async with exe.start(detach=False) as stream:
                    while True:
                        msg = await stream.read_out()
                        if msg is None:
                            break
                        if size < MAX_OUTPUT:
                            chunks.append(msg.data)
                            size += len(msg.data)

            try:
                await asyncio.wait_for(_read(), timeout=timeout)
            except TimeoutError:
                return ExecResult(
                    exit_code=124,
                    output=b"".join(chunks).decode("utf-8", "replace")[:MAX_OUTPUT],
                    duration_ms=int((time.perf_counter() - t0) * 1000),
                    timed_out=True,
                )
            info = await exe.inspect()
        except aiodocker.DockerError as exc:
            raise SandboxError(f"Ошибка выполнения в среде: {exc.message}") from exc
        out = b"".join(chunks).decode("utf-8", "replace")[:MAX_OUTPUT]
        return ExecResult(
            exit_code=int(info.get("ExitCode") or 0), output=out, duration_ms=int((time.perf_counter() - t0) * 1000)
        )

    async def inspect(self, container_id: str) -> dict[str, Any]:
        container = await self._container(container_id)
        data: dict[str, Any] = await container.show()
        return data

    async def state(self, container_id: str) -> dict[str, Any]:
        """Short state for docker_inspect checks."""
        try:
            data = await self.inspect(container_id)
        except aiodocker.DockerError:
            return {"exists": False, "status": "missing", "restart_count": 0, "oom_killed": False}
        st = data.get("State", {})
        return {
            "exists": True,
            "status": st.get("Status"),
            "running": st.get("Running", False),
            "restart_count": data.get("RestartCount", 0),
            "oom_killed": st.get("OOMKilled", False),
            "exit_code": st.get("ExitCode"),
        }

    async def srv_volume(self, container_id: str) -> str | None:
        """Name of the anonymous volume mounted at /srv."""
        info = await self.inspect(container_id)
        return next((m.get("Name") for m in info.get("Mounts", []) if m.get("Destination") == "/srv"), None)

    async def volume_sizes_mb(self) -> dict[str, int]:
        """Volume sizes measured by the Docker daemon (as root): files a student hides with chmod still count."""
        data = await self.docker._query_json("system/df", params={"type": "volume"}, timeout=20)
        out: dict[str, int] = {}
        for v in data.get("Volumes") or []:
            size = int((v.get("UsageData") or {}).get("Size", -1))
            if size >= 0:
                out[str(v.get("Name"))] = size // (1024 * 1024)
        return out

    async def pause(self, container_id: str) -> None:
        await (await self._container(container_id)).pause()

    async def unpause(self, container_id: str) -> None:
        await (await self._container(container_id)).unpause()

    async def snapshot(self, container_id: str, dest_dir: str, name: str, max_mb: int = 1024) -> str:
        """Stream /srv out of the container into <dest_dir>/<name>.tar (expired sessions), at most max_mb."""
        path = Path(dest_dir) / f"{uuid.UUID(name)}.tar"  # the name is a session id, never a path
        path.parent.mkdir(parents=True, exist_ok=True)
        limit, size = max_mb * 1024 * 1024, 0
        try:
            async with self.docker._query(
                f"containers/{container_id}/archive", method="GET", params={"path": "/srv"}
            ) as resp:
                if resp.status != 200:
                    raise SandboxError(f"Снимок среды не получен: HTTP {resp.status}")
                with path.open("wb") as out:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        size += len(chunk)
                        if size > limit:
                            resp.close()  # drop the connection instead of draining the rest of the archive
                            raise SandboxError(f"Снимок среды больше {max_mb} МБ, не сохранён")
                        out.write(chunk)
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        return str(path)

    async def remove(self, container_id: str) -> None:
        """Remove the container together with its anonymous /srv volume."""
        try:
            container = await self._container(container_id)
            await container.delete(force=True, v=True)
        except aiodocker.DockerError as exc:
            if exc.status != 404:
                raise SandboxError(f"Не удалось удалить среду: {exc.message}") from exc

    async def list_by_label(self, label: str = LABEL_SESSION) -> list[dict[str, Any]]:
        """Containers of this installation only (filtered by masso.instance as well)."""
        filters = {"label": [label, f"{LABEL_INSTANCE}={self.instance}"]}
        items = await self.docker.containers.list(all=True, filters=filters)
        out: list[dict[str, Any]] = []
        for c in items:
            d = c._container
            out.append(
                {
                    "id": d.get("Id"),
                    "name": (d.get("Names") or [""])[0].lstrip("/"),
                    "labels": d.get("Labels", {}),
                    "state": d.get("State"),
                    "status": d.get("Status"),
                    "created": d.get("Created"),
                }
            )
        return out

    async def stats(self, container_id: str) -> dict[str, Any]:
        container = await self._container(container_id)
        st: Any = await container.stats(stream=False)
        data = st[0] if isinstance(st, list) else st
        mem = data.get("memory_stats", {})
        return {
            "mem_usage": mem.get("usage"),
            "mem_limit": mem.get("limit"),
            "pids": data.get("pids_stats", {}).get("current"),
        }


_manager: SandboxManager | None = None


def get_sandbox() -> SandboxManager:
    global _manager
    if _manager is None:
        _manager = SandboxManager()
    return _manager


def set_sandbox(manager: SandboxManager | None) -> None:
    """Tests inject a fake manager here."""
    global _manager
    _manager = manager
