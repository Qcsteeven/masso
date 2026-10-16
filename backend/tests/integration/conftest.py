import os
import uuid
from collections.abc import AsyncIterator

import aiodocker
import pytest

from app.sandbox.manager import Profile, SandboxManager

IMAGE = os.environ.get("SANDBOX_IMAGE", "masso/webstack:latest")


@pytest.fixture(scope="session")
async def docker_ready() -> None:
    try:
        async with aiodocker.Docker() as d:
            await d.images.inspect(IMAGE)
    except Exception as exc:  # no daemon or no image
        pytest.skip(f"Docker или образ {IMAGE} недоступен: {exc}")


@pytest.fixture
async def manager(docker_ready: None) -> AsyncIterator[SandboxManager]:
    m = SandboxManager()
    yield m
    for c in await m.list_by_label("masso.kind=test"):
        await m.remove(c["id"])
    await m.close()


PROFILE = Profile(code="small", image=IMAGE, cpu=1.0, mem_mb=1024, pids_limit=128, storage_mb=512)


@pytest.fixture
async def container(manager: SandboxManager) -> AsyncIterator[str]:
    cid = await manager.create(uuid.uuid4().hex, "test-user", PROFILE, kind="test")
    yield cid
    await manager.remove(cid)
