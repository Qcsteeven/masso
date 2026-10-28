"""Learning sessions: lifecycle, sandbox, document trainer, incidents, idle control (spec §6, §7)."""

import base64
import binascii
import json
import logging
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import record_security
from app.config import get_settings
from app.deps import CurrentUser, can_see_group
from app.errors import AppError, ErrorCode
from app.events.models import EnvironmentEvent
from app.events.service import STUDENT_VISIBLE, event_out, record_event
from app.sandbox.manager import SandboxError, get_sandbox
from app.sandbox.service import ensure_capacity, load_profile
from app.scenarios.models import ScenarioRun
from app.scenarios.spec import CodeSpec, ContainerSpec, DocumentSpec, parse_spec, to_public
from app.sessions.detectors import classify_command
from app.sessions.models import Hint, LearningSession
from app.users.models import User

log = logging.getLogger("masso.sessions")

ACTIVE = ("starting", "active", "paused")
OPEN = ("created", "starting", "active", "paused")
DONE = ("submitted", "checking", "completed", "failed", "expired")


def now_utc() -> datetime:
    return datetime.now(UTC)


async def get_session(db: AsyncSession, session_id: uuid.UUID) -> LearningSession:
    s = await db.get(LearningSession, session_id)
    if s is None:
        raise AppError(ErrorCode.NOT_FOUND, "Учебная сессия не найдена.")
    return s


async def check_access(db: AsyncSession, user: CurrentUser, s: LearningSession, *, write: bool = False) -> None:
    if s.user_id == user.id:
        return
    if not write and (user.has("admin") or user.has("teacher")):
        owner = await db.get(User, s.user_id)
        if owner is not None and can_see_group(user, owner.group_code):
            return
    raise AppError(ErrorCode.AUTH_FORBIDDEN, "Нет доступа к этой учебной сессии.")


async def load_spec(db: AsyncSession, s: LearningSession) -> tuple[ScenarioRun, ContainerSpec | DocumentSpec]:
    run = await db.get(ScenarioRun, s.run_id)
    assert run is not None
    return run, parse_spec(run.generated_spec)


def _incident_due(
    spec: ContainerSpec | DocumentSpec, start: datetime, index: int, rng: random.Random
) -> datetime | None:
    if index >= len(spec.incidents):
        return None
    lo, hi = spec.incidents[index].after_min
    return start + timedelta(minutes=rng.uniform(lo, min(hi, 5.0)))  # ТЗ 4.2: not later than 5 minutes


async def start_session(db: AsyncSession, user: CurrentUser, run_id: uuid.UUID) -> LearningSession:
    run = await db.get(ScenarioRun, run_id)
    if run is None or run.user_id != user.id:
        raise AppError(ErrorCode.NOT_FOUND, "Сценарий не найден.")
    if run.status != "published":
        raise AppError(ErrorCode.SCENARIO_NOT_VALID, "Сценарий не прошёл валидацию и не может быть запущен.")
    existing = await db.scalar(
        select(LearningSession).where(LearningSession.run_id == run.id, LearningSession.status.in_(OPEN))
    )
    if existing is not None:
        return existing
    spec = parse_spec(run.generated_spec)
    if isinstance(spec, ContainerSpec):
        # serialize this student's session starts so that parallel requests cannot pass the check together
        await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"session:{user.id}"})
        busy = await db.scalar(
            select(func.count())
            .select_from(LearningSession)
            .where(
                LearningSession.user_id == user.id,
                LearningSession.kind == "container",
                LearningSession.status.in_(OPEN),
            )
        )
        if busy:  # one training server per student: a single account must not exhaust the stand
            raise AppError(
                ErrorCode.SESSION_NOT_READY,
                "У вас уже есть незавершённая сессия с учебным сервером. Завершите её, чтобы начать новую.",
            )
    now = now_utc()
    s = LearningSession(
        run_id=run.id,
        user_id=user.id,
        status="starting",
        kind=spec.kind,
        trace_id=uuid.uuid4().hex,
        time_limit_min=spec.time_limit_min,
        started_at=now,
        last_activity_at=now,
    )
    if isinstance(spec, ContainerSpec):
        await ensure_capacity(db)
    db.add(s)
    await db.flush()
    record_event(db, s, "status", {"status": "starting", "message": "Подготовка учебной среды…"})
    await db.commit()
    try:
        if isinstance(spec, ContainerSpec):
            sandbox = get_sandbox()
            profile = await load_profile(db, spec.profile)
            cid = await sandbox.create(str(s.id), str(user.id), profile)
            s.sandbox_container_id = cid
            fault = spec.faults.catalog[spec.chosen.get("initial_fault") or spec.faults.initial[0]]
            res = await sandbox.exec(cid, fault.apply, timeout=60)
            if res.timed_out:
                raise SandboxError("начальное состояние сценария не применилось")
            await sandbox.exec(cid, "rm -f /tmp/.masso/cmd.log; mkdir -p /tmp/.masso", timeout=10)
        else:
            s.documents_state = {
                "documents": {d.id: d.markdown for d in spec.documents},
                # code engine: the workspace starts from the skeleton files
                "answers": {"files": dict(spec.files)} if isinstance(spec, CodeSpec) else {},
                "applied_incidents": [],
            }
    except (SandboxError, AppError) as exc:
        s.status, s.error, s.finished_at = "failed", str(exc)[:500], now_utc()
        record_event(db, s, "status", {"status": "failed", "message": "Не удалось запустить учебную среду."}, "error")
        await db.commit()
        if s.sandbox_container_id:
            await get_sandbox().remove(s.sandbox_container_id)
        raise AppError(ErrorCode.SESSION_NOT_READY, "Не удалось запустить учебную среду. Повторите попытку.") from exc
    started = now_utc()
    s.status, s.started_at, s.last_activity_at = "active", started, started
    s.incident_due_at = _incident_due(spec, started, 0, random.Random(s.id.int))
    record_event(
        db,
        s,
        "status",
        {
            "status": "active",
            "message": "Учебная среда готова.",
            "startup_sec": round((started - now).total_seconds(), 1),
        },
    )
    await db.commit()
    return s


def applied_incidents(s: LearningSession, events: list[EnvironmentEvent]) -> set[str]:
    ids = {str(e.payload.get("id")) for e in events if e.type == "incident" and e.payload.get("id")}
    if s.documents_state:
        ids.update(s.documents_state.get("applied_incidents", []))
    return ids


async def session_view(db: AsyncSession, user: CurrentUser, s: LearningSession) -> dict[str, Any]:
    run, spec = await load_spec(db, s)
    pub = to_public(str(run.id), spec)
    if s.documents_state:
        docs = s.documents_state.get("documents", {})
        for d in pub.documents:
            d.markdown = docs.get(d.id, d.markdown)
    events = [e for e in await _events(db, s.id) if e.type in STUDENT_VISIBLE]
    hints_used = await db.scalar(select(func.count()).select_from(Hint).where(Hint.session_id == s.id)) or 0
    deadline = (s.started_at + timedelta(minutes=s.time_limit_min)) if s.started_at else None
    paused_extra = timedelta()
    remaining = None
    if deadline is not None:
        ref = s.paused_at if s.status == "paused" and s.paused_at else (s.finished_at or now_utc())
        remaining = max(0, int((deadline + paused_extra - ref).total_seconds()))
    return {
        "id": str(s.id),
        "run_id": str(s.run_id),
        "status": s.status,
        "kind": s.kind,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "finished_at": s.finished_at.isoformat() if s.finished_at else None,
        "time_limit_min": s.time_limit_min,
        "remaining_sec": remaining,
        "hints_used": hints_used,
        "hints_max": pub.hints_max,
        "scenario": pub.model_dump(mode="json"),
        "answers": (s.documents_state or {}).get("answers", {}),
        "events": [event_out(e) for e in events],
    }


async def _events(db: AsyncSession, session_id: uuid.UUID) -> list[EnvironmentEvent]:
    return list(
        (
            await db.scalars(
                select(EnvironmentEvent)
                .where(EnvironmentEvent.session_id == session_id)
                .order_by(EnvironmentEvent.created_at)
            )
        ).all()
    )


async def lock_session(db: AsyncSession, s: LearningSession) -> None:
    """Lock the session row until the caller commits and reload it (concurrent hints/submit see the result)."""
    await db.execute(
        select(LearningSession)
        .where(LearningSession.id == s.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


async def touch(db: AsyncSession, s: LearningSession, now: datetime | None = None) -> None:
    """Register activity; resume a paused session."""
    now = now or now_utc()
    if s.status == "paused":
        await resume(db, s, now)
    s.last_activity_at = now


async def pause(db: AsyncSession, s: LearningSession, now: datetime | None = None, *, reason: str = "manual") -> None:
    if s.status != "active":
        raise AppError(ErrorCode.SESSION_NOT_READY, "Сессию можно приостановить только во время выполнения.")
    now = now or now_utc()
    if s.sandbox_container_id:
        try:
            await get_sandbox().pause(s.sandbox_container_id)
        except Exception as exc:
            log.warning("pause failed: %s", exc)
    s.status, s.paused_at = "paused", now
    msg = "Сессия приостановлена из-за бездействия." if reason == "idle" else "Сессия приостановлена."
    record_event(
        db,
        s,
        "status",
        {"status": "paused", "reason": reason, "message": msg},
        "warning" if reason == "idle" else "info",
    )


async def resume(db: AsyncSession, s: LearningSession, now: datetime | None = None) -> None:
    if s.status != "paused":
        raise AppError(ErrorCode.SESSION_NOT_READY, "Сессия не приостановлена.")
    now = now or now_utc()
    if s.sandbox_container_id:
        try:
            await get_sandbox().unpause(s.sandbox_container_id)
        except Exception as exc:
            log.warning("unpause failed: %s", exc)
    if s.paused_at and s.started_at:
        # paused time does not count towards the time limit
        delta = now - s.paused_at
        s.started_at = s.started_at + delta
        if s.incident_due_at and s.incident_applied_at is None:
            s.incident_due_at = s.incident_due_at + delta
    s.status, s.paused_at, s.last_activity_at = "active", None, now
    record_event(db, s, "status", {"status": "active", "message": "Сессия возобновлена."})


async def save_answers(db: AsyncSession, s: LearningSession, answers: dict[str, Any]) -> dict[str, Any]:
    if s.kind not in ("document", "code"):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "Ответ через форму предусмотрен только в документных сценариях и задачах на код.",
        )
    if s.status not in ("active", "paused"):
        raise AppError(ErrorCode.SESSION_NOT_READY, "Сессия не активна.")
    if len(json.dumps(answers, ensure_ascii=False)) > MAX_ANSWER_CHARS:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Ответ слишком большой.", {"max_chars": MAX_ANSWER_CHARS})
    findings = answers.get("findings", []) if isinstance(answers, dict) else []
    for f in findings if isinstance(findings, list) else []:
        if isinstance(f, dict) and any(len(str(v)) > MAX_FIELD_CHARS for v in f.values()):
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                f"Поле замечания длиннее {MAX_FIELD_CHARS} символов.",
                {"max_field_chars": MAX_FIELD_CHARS},
            )
    _run, spec = await load_spec(db, s)
    if isinstance(spec, CodeSpec):
        check_code_files(spec, answers)
    elif isinstance(spec, DocumentSpec) and isinstance(findings, list):
        # listing every section × defect type would pass the rule checks without reading the documents
        cap = len(spec.answer_key) + sum(1 for i in spec.incidents if i.adds_answer) + EXTRA_FINDINGS
        if len(findings) > cap:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                f"Слишком много замечаний: укажите не более {cap}. Перечислять все варианты подряд нельзя.",
                {"max_findings": cap},
            )
    await touch(db, s)
    state = dict(s.documents_state or {})
    state["answers"] = answers
    s.documents_state = state
    n = len(answers.get("findings", []) or []) if isinstance(answers, dict) else 0
    record_event(db, s, "answer", {"fields": sorted(answers)[:20], "findings": n}, push=False)
    await db.commit()
    return answers


async def apply_incident(db: AsyncSession, s: LearningSession, now: datetime) -> bool:
    """Apply the next due incident. Returns True if something was applied."""
    _run, spec = await load_spec(db, s)
    done = applied_incidents(s, await _events(db, s.id))
    pending = [i for i in spec.incidents if i.id not in done]
    if not pending:
        s.incident_due_at = None
        return False
    inc = pending[0]
    if isinstance(spec, ContainerSpec):
        if not s.sandbox_container_id:
            return False
        fault = spec.faults.catalog[inc.fault or ""]
        res = await get_sandbox().exec(s.sandbox_container_id, fault.apply, timeout=60)
        if res.timed_out:
            log.warning("incident apply timed out for %s", s.id)
            return False
    else:
        state = dict(s.documents_state or {})
        docs = dict(state.get("documents", {}))
        if inc.mutation is not None and inc.mutation.doc_id in docs:
            docs[inc.mutation.doc_id] = docs[inc.mutation.doc_id].replace(inc.mutation.find, inc.mutation.replace, 1)
        state["documents"] = docs
        state["applied_incidents"] = [*state.get("applied_incidents", []), inc.id]
        s.documents_state = state
    s.incident_applied_at = now
    record_event(
        db,
        s,
        "incident",
        {"id": inc.id, "message": inc.message, "document": inc.mutation.doc_id if inc.mutation else None},
        "warning",
        created_at=now,
    )
    next_index = len(done) + 1
    s.incident_due_at = _incident_due(spec, now, next_index, random.Random(s.id.int + next_index))
    if s.incident_due_at is not None:
        s.incident_applied_at = None
    return True


def check_code_files(spec: CodeSpec, answers: dict[str, Any]) -> dict[str, str]:
    """The answer of a code session: {"files": {name: text}} with the scenario's file names only."""
    from app.coderun.runner import MAX_FILE_CHARS

    files = answers.get("files")
    if (
        not isinstance(files, dict)
        or set(answers) - {"files"}
        or not set(files) <= set(spec.files)
        or not all(isinstance(v, str) and len(v) <= MAX_FILE_CHARS for v in files.values())
    ):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Ожидаются файлы {', '.join(sorted(spec.files))} размером до {MAX_FILE_CHARS} символов.",
        )
    return {str(k): str(v) for k, v in files.items()}


EXTRA_FINDINGS = 2  # findings allowed beyond the answer key
MAX_ANSWER_CHARS = 64_000
MAX_FIELD_CHARS = 1000
CMD_LOG = "/tmp/.masso/cmd.log"  # noqa: S108 - path inside the training container
CMD_CHUNK_BYTES = 32 * 1024  # base64 of it (~44 KB) fits into the exec output limit (64 KB)
CMD_LINES_PER_TICK = 200
CMD_FLOOD_BYTES = 1024 * 1024  # an honest session writes far less between two ticks


def parse_cmd_log(chunk: str) -> list[tuple[datetime | None, str, str]]:
    """Lines `epoch<TAB>pwd<TAB>command` from the training server (written by the student's shell, so untrusted)."""
    out: list[tuple[datetime | None, str, str]] = []
    for line in chunk.splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3 or not parts[2].strip():
            continue
        try:
            ts: datetime | None = datetime.fromtimestamp(int(parts[0]), UTC)
        except (ValueError, OverflowError, OSError):
            ts = None
        out.append((ts, parts[1][:200], parts[2][:1000]))
    return out


def split_cmd_chunk(data: bytes, max_lines: int = CMD_LINES_PER_TICK) -> bytes:
    """Complete lines only, at most max_lines; the byte length of the result is the offset advance."""
    end, lines = 0, 0
    while lines < max_lines:
        nl = data.find(b"\n", end)
        if nl < 0:
            break
        end, lines = nl + 1, lines + 1
    if end == 0 and len(data) >= CMD_CHUNK_BYTES:  # a line longer than a chunk: skip this part of it
        return data
    return data[:end]


async def collect_commands(db: AsyncSession, s: LearningSession) -> int:
    """Read new lines of the command log into the digital footprint; detect suspicious commands."""
    if not s.sandbox_container_id or s.status != "active":
        return 0
    res = await get_sandbox().exec(
        s.sandbox_container_id,
        # a FIFO or another non-regular file in place of the log must not hang the worker on `tail`
        f"if [ -e {CMD_LOG} ] && [ ! -f {CMD_LOG} ]; then echo notfile; exit 0; fi; "
        f"stat -c %s {CMD_LOG} 2>/dev/null || echo 0; "
        f"timeout 3 tail -c +{max(s.cmd_log_offset, 0) + 1} {CMD_LOG} 2>/dev/null"
        f" | head -c {CMD_CHUNK_BYTES} | base64 -w0",
        timeout=10,
    )
    size_line, _, b64 = res.output.partition("\n")
    now = now_utc()
    tampered = size_line.strip() == "notfile"
    try:
        size = 0 if tampered else int(size_line.strip() or 0)
        data = base64.b64decode(b64.strip() or b"")
    except (ValueError, binascii.Error):
        log.warning("command log of %s could not be decoded", s.id)
        s.cmd_log_offset += CMD_CHUNK_BYTES  # never get stuck on the same bytes
        return 0
    if tampered and s.cmd_log_offset < 0:
        return 0  # already reported, waiting for a regular log file again
    if s.cmd_log_offset < 0:
        s.cmd_log_offset = 0
    if size - s.cmd_log_offset > CMD_FLOOD_BYTES:
        # flooded (sparse file, millions of lines): jump to the tail so that new commands are still seen
        record_security(
            db, kind="log_tampering", user_id=s.user_id, session_id=s.id, severity="high", details={"flood": size}
        )
        msg = "Журнал команд учебной среды переполнен посторонними данными."
        record_event(db, s, "security", {"kind": "log_tampering", "message": msg}, "critical")
        s.cmd_log_offset = size - CMD_CHUNK_BYTES
        return 1
    if tampered or size < s.cmd_log_offset:  # the log was truncated or replaced from inside the container
        record_security(
            db, kind="log_tampering", user_id=s.user_id, session_id=s.id, severity="high", details={"size": size}
        )
        msg = "Журнал команд учебной среды был изменён."
        record_event(db, s, "security", {"kind": "log_tampering", "message": msg}, "critical")
        s.cmd_log_offset = -1 if tampered else size  # -1: a non-regular file was reported once
        return 1
    raw = split_cmd_chunk(data)
    if not raw:
        return 0
    s.cmd_log_offset += len(raw)
    complete = raw.decode("utf-8", "replace")
    lo = (s.started_at or now) - timedelta(days=1)
    n = 0
    for ts, cwd, cmd in parse_cmd_log(complete):
        if ts is not None and not lo <= ts <= now + timedelta(minutes=1):
            ts = None  # the student's shell writes the timestamps; implausible ones are replaced by now
        n += 1
        record_event(db, s, "command", {"cmd": cmd, "cwd": cwd}, push=False, created_at=ts)
        kind = classify_command(cmd)
        if kind:
            record_security(
                db, kind=kind, user_id=s.user_id, session_id=s.id, severity="high", details={"cmd": cmd[:300]}
            )
            record_event(
                db,
                s,
                "security",
                {"kind": kind, "cmd": cmd[:300], "message": "Действие заблокировано политикой учебной среды."},
                "critical",
                created_at=ts,
            )
    if n and s.last_activity_at is not None:
        s.last_activity_at = max(s.last_activity_at, now_utc())
    return n


async def expire(db: AsyncSession, s: LearningSession, now: datetime) -> None:
    """24 h without activity: keep a snapshot of /srv, remove the container, mark expired."""
    if s.sandbox_container_id:
        sb = get_sandbox()
        try:
            await sb.snapshot(s.sandbox_container_id, get_settings().sandbox_snapshot_dir, str(s.id))
        except Exception as exc:
            log.warning("snapshot failed for %s: %s", s.id, exc)
        await sb.remove(s.sandbox_container_id)
        s.sandbox_container_id = None
    s.status, s.finished_at = "expired", now
    record_event(
        db,
        s,
        "status",
        {"status": "expired", "message": "Сессия завершена: нет активности более 24 часов. Состояние сохранено."},
        "warning",
    )
