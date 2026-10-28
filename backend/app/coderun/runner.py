"""Running student code in a throwaway sandbox container (Д-44).

A box is a fresh container of the sandbox image started with `sleep infinity` (no services), with the same
isolation as a learning environment: user student, no network, cap_drop ALL, read-only rootfs, cpu/mem/pids limits.
Files go to /srv/task; the box is removed right after the run, so nothing leaks between runs or to the student.
"""

import asyncio
import base64
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Protocol

from app.coderun.scripts import MARKER
from app.config import get_settings
from app.sandbox.manager import Profile, SandboxManager, get_sandbox

TASK_DIR = "/srv/task"
FILE_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,40}\.py$")
MAX_FILE_CHARS = 32_000
MAX_PARALLEL_BOXES = 6
_slots = asyncio.Semaphore(MAX_PARALLEL_BOXES)


@dataclass(frozen=True)
class RunOutput:
    ok: bool  # finished in time with a result
    result: dict[str, Any]
    stdout: str  # the student's own prints and errors, trimmed
    timed_out: bool
    duration_ms: int


def parse_output(raw: str, timed_out: bool, duration_ms: int) -> RunOutput:
    head, sep, tail = raw.rpartition(MARKER)
    result: dict[str, Any] = {}
    if sep:
        try:
            result = json.loads(tail.strip().splitlines()[0])
        except (ValueError, IndexError):
            result = {}
    stdout = (head if sep else raw).strip()[-4000:]
    return RunOutput(
        ok=bool(result) and not timed_out, result=result, stdout=stdout, timed_out=timed_out, duration_ms=duration_ms
    )


class Box(Protocol):
    async def write(self, files: dict[str, str]) -> None: ...

    async def python(self, script: str, data: dict[str, Any] | None, timeout: float) -> RunOutput: ...


def check_files(files: dict[str, str]) -> None:
    for name, text in files.items():
        if not FILE_NAME.match(name) or len(text) > MAX_FILE_CHARS:
            raise ValueError(f"недопустимый файл {name!r}")


class DockerBox:
    def __init__(self, sandbox: SandboxManager, cid: str) -> None:
        self.sandbox, self.cid = sandbox, cid

    async def _put(self, path: str, text: str) -> None:
        b64 = base64.b64encode(text.encode()).decode()
        await self.sandbox.exec(
            self.cid, f"mkdir -p {os.path.dirname(path)} && printf '%s' '{b64}' | base64 -d > {path}", timeout=15
        )

    async def write(self, files: dict[str, str]) -> None:
        check_files(files)
        for name, text in files.items():
            await self._put(f"{TASK_DIR}/{name}", text)

    async def python(self, script: str, data: dict[str, Any] | None, timeout: float) -> RunOutput:
        tag = uuid.uuid4().hex[:8]
        await self._put(f"/tmp/run_{tag}.py", script)  # noqa: S108  (tmpfs of a throwaway container)
        arg = ""
        if data is not None:
            await self._put(f"/tmp/in_{tag}.json", json.dumps(data, ensure_ascii=False))  # noqa: S108
            arg = f" /tmp/in_{tag}.json"
        r = await self.sandbox.exec(self.cid, f"cd {TASK_DIR} && python3 -B /tmp/run_{tag}.py{arg}", timeout=timeout)
        return parse_output(r.output, r.timed_out, r.duration_ms)


class LocalBox:
    """Same contract in a temp dir with the local interpreter: unit tests and generator self-checks only."""

    def __init__(self, root: str) -> None:
        self.root = root

    async def write(self, files: dict[str, str]) -> None:
        check_files(files)
        for name, text in files.items():
            with open(os.path.join(self.root, name), "w", encoding="utf-8") as f:  # noqa: ASYNC230
                f.write(text)

    async def python(self, script: str, data: dict[str, Any] | None, timeout: float) -> RunOutput:
        tag = uuid.uuid4().hex[:8]
        path = os.path.join(self.root, f"_run_{tag}.py")
        with open(path, "w", encoding="utf-8") as f:  # noqa: ASYNC230
            f.write(script)
        argv = [sys.executable, "-B", path]
        if data is not None:
            inp = os.path.join(self.root, f"_in_{tag}.json")
            with open(inp, "w", encoding="utf-8") as f:  # noqa: ASYNC230
                json.dump(data, f, ensure_ascii=False)
            argv.append(inp)
        loop = asyncio.get_running_loop()
        t0 = loop.time()
        proc = await asyncio.create_subprocess_exec(
            *argv, cwd=self.root, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout)
            timed_out = False
        except TimeoutError:
            proc.kill()
            out, timed_out = b"", True
        return parse_output(out.decode("utf-8", "replace"), timed_out, int((loop.time() - t0) * 1000))


class CodeRunner:
    def __init__(self, sandbox: SandboxManager | None = None, local: bool = False) -> None:
        self._sandbox, self.local = sandbox, local

    @asynccontextmanager
    async def box(self) -> AsyncIterator[Box]:
        if self.local:
            root = tempfile.mkdtemp(prefix="masso-code-")
            try:
                yield LocalBox(root)
            finally:
                shutil.rmtree(root, ignore_errors=True)
            return
        sb = self._sandbox or get_sandbox()
        s = get_settings()
        profile = Profile(code="code", image=s.sandbox_image, cpu=1.0, mem_mb=512, pids_limit=64, storage_mb=64)
        async with _slots:
            cid = await sb.create(
                uuid.uuid4().hex, "coderun", profile, kind="validation", wait_ready=0, cmd=["sleep", "infinity"]
            )
            try:
                yield DockerBox(sb, cid)
            finally:
                await sb.remove(cid)


_runner: CodeRunner | None = None


def get_code_runner() -> CodeRunner:
    global _runner
    if _runner is None:
        _runner = CodeRunner()
    return _runner


def set_code_runner(runner: CodeRunner | None) -> None:
    """Tests switch to a local runner."""
    global _runner
    _runner = runner
