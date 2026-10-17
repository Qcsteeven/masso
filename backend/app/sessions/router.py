import asyncio
import contextlib
import json
import logging
import time
import uuid
from typing import Any

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.auth.security import create_ws_token, decode_token
from app.db import get_sessionmaker
from app.deps import DB, Me, StudentUser
from app.errors import AppError, ErrorCode, ok
from app.events import bus
from app.sandbox.manager import STUDENT, get_sandbox
from app.sessions import service
from app.sessions.models import LearningSession
from app.users.models import User

log = logging.getLogger("masso.ws")
router = APIRouter(prefix="/api/sessions", tags=["sessions"])
ws_router = APIRouter(tags=["ws"])
routers = [router, ws_router]


class StartIn(BaseModel):
    run_id: uuid.UUID


class AnswersIn(BaseModel):
    answers: dict[str, Any]


@router.post("", status_code=201)
async def start(body: StartIn, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await service.start_session(db, user, body.run_id)
    return ok(await service.session_view(db, user, s))


@router.get("/mine")
async def mine(user: StudentUser, db: DB) -> dict[str, Any]:
    from sqlalchemy import select

    from app.scenarios.models import ScenarioRun, ScenarioTemplate

    rows = (
        await db.execute(
            select(LearningSession, ScenarioTemplate.title, ScenarioTemplate.code)
            .join(ScenarioRun, ScenarioRun.id == LearningSession.run_id)
            .join(ScenarioTemplate, ScenarioTemplate.id == ScenarioRun.template_id)
            .where(LearningSession.user_id == user.id)
            .order_by(LearningSession.created_at.desc())
            .limit(100)
        )
    ).all()
    return ok(
        [
            {
                "id": str(s.id),
                "status": s.status,
                "kind": s.kind,
                "title": title,
                "code": code,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            }
            for s, title, code in rows
        ]
    )


@router.get("/{session_id}")
async def get(session_id: uuid.UUID, user: Me, db: DB) -> dict[str, Any]:
    s = await service.get_session(db, session_id)
    await service.check_access(db, user, s)
    return ok(await service.session_view(db, user, s))


@router.post("/{session_id}/pause")
async def pause(session_id: uuid.UUID, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await service.get_session(db, session_id)
    await service.check_access(db, user, s, write=True)
    await service.pause(db, s)
    await db.commit()
    return ok({"status": s.status})


@router.post("/{session_id}/resume")
async def resume(session_id: uuid.UUID, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await service.get_session(db, session_id)
    await service.check_access(db, user, s, write=True)
    await service.resume(db, s)
    await db.commit()
    return ok({"status": s.status})


@router.post("/{session_id}/answers")
async def answers(session_id: uuid.UUID, body: AnswersIn, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await service.get_session(db, session_id)
    await service.check_access(db, user, s, write=True)
    return ok({"answers": await service.save_answers(db, s, body.answers)})


@router.post("/{session_id}/ws-token")
async def ws_token(session_id: uuid.UUID, user: StudentUser, db: DB) -> dict[str, Any]:
    s = await service.get_session(db, session_id)
    await service.check_access(db, user, s, write=True)
    if s.status not in ("active", "paused"):
        raise AppError(ErrorCode.SESSION_NOT_READY, "Учебная среда не запущена.")
    return ok({"token": create_ws_token(user.id, s.id), "expires_in": 60})


async def _authorize_ws(ws: WebSocket, session_id: uuid.UUID) -> LearningSession | None:
    token = ws.query_params.get("token", "")
    try:
        claims = decode_token(token, "ws")
        if claims.get("sid") != str(session_id):
            raise jwt.InvalidTokenError("session mismatch")
        user_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        await ws.close(code=4401, reason="unauthorized")
        return None
    async with get_sessionmaker()() as db:
        s = await db.get(LearningSession, session_id)
        owner = await db.get(User, user_id)
        if s is None or s.user_id != user_id or owner is None or owner.status != "active":
            await ws.close(code=4403, reason="forbidden")
            return None
        return s


@ws_router.websocket("/ws/sessions/{session_id}/events")
async def ws_events(ws: WebSocket, session_id: uuid.UUID) -> None:
    s = await _authorize_ws(ws, session_id)
    if s is None:
        return
    await ws.accept()
    q = bus.subscribe(session_id)
    try:
        await ws.send_json({"type": "status", "payload": {"status": s.status}})
        while True:
            getter = asyncio.ensure_future(q.get())
            receiver = asyncio.ensure_future(ws.receive_text())
            done, pending = await asyncio.wait({getter, receiver}, timeout=25, return_when=asyncio.FIRST_COMPLETED)
            for p in pending:
                p.cancel()
            if not done:
                await ws.send_json({"type": "ping"})
                continue
            if receiver in done:
                receiver.result()  # raises on disconnect; client messages are ignored
            if getter in done:
                await ws.send_json(getter.result())
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        bus.unsubscribe(session_id, q)


@ws_router.websocket("/ws/sessions/{session_id}/terminal")
async def ws_terminal(ws: WebSocket, session_id: uuid.UUID) -> None:
    """Bridge xterm.js <-> `docker exec -it bash -l` as `student` (binary frames; JSON frame for resize)."""
    s = await _authorize_ws(ws, session_id)
    if s is None:
        return
    if s.kind != "container" or not s.sandbox_container_id or s.status not in ("active", "paused"):
        await ws.close(code=4409, reason="session not ready")
        return
    await ws.accept()
    async with get_sessionmaker()() as db:
        live = await db.get(LearningSession, session_id)
        if live is not None and live.status == "paused":
            await service.resume(db, live)
            await db.commit()
    sandbox = get_sandbox()
    container = sandbox.docker.containers.container(s.sandbox_container_id)
    exe = await container.exec(
        ["bash", "-l"],
        stdin=True,
        stdout=True,
        stderr=True,
        tty=True,
        user=STUDENT,
        workdir="/srv",
        environment={"TERM": "xterm-256color", "LANG": "C.UTF-8"},
    )
    last_touch = 0.0

    async def touch() -> None:
        nonlocal last_touch
        if time.monotonic() - last_touch < 10:
            return
        last_touch = time.monotonic()
        async with get_sessionmaker()() as db:
            live = await db.get(LearningSession, session_id)
            if live is not None:
                await service.touch(db, live)
                await db.commit()

    async with exe.start(detach=False) as stream:

        async def pump_out() -> None:
            while True:
                msg = await stream.read_out()
                if msg is None:
                    break
                await ws.send_bytes(msg.data)

        async def pump_in() -> None:
            while True:
                m = await ws.receive()
                if m["type"] == "websocket.disconnect":
                    break
                if m.get("bytes") is not None:
                    await stream.write_in(m["bytes"])
                    await touch()
                elif m.get("text") is not None:
                    try:
                        data = json.loads(m["text"])
                    except ValueError:
                        await stream.write_in(m["text"].encode())
                        await touch()
                        continue
                    if isinstance(data, dict) and data.get("type") == "resize":
                        with contextlib.suppress(Exception):
                            await exe.resize(h=int(data.get("rows", 24)), w=int(data.get("cols", 80)))
                    elif isinstance(data, dict) and data.get("type") == "input":
                        await stream.write_in(str(data.get("data", "")).encode())
                        await touch()

        tasks = [asyncio.create_task(pump_out()), asyncio.create_task(pump_in())]
        try:
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        except Exception:
            log.exception("terminal bridge failed")
        finally:
            for t in tasks:
                t.cancel()
            with contextlib.suppress(Exception):
                await ws.close()
