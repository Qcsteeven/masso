"""«Запустить тесты» in a code session (Д-44): public examples and the student's own tests, nothing is scored."""

import math
import time
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.coderun.checks import run_cases, run_student_tests
from app.coderun.runner import get_code_runner
from app.errors import AppError, ErrorCode
from app.events.service import record_event
from app.scenarios.spec import CodeSpec
from app.sessions.models import LearningSession
from app.sessions.service import check_code_files, load_spec, lock_session, touch

RUN_INTERVAL_SEC = 3.0
_last_run: dict[uuid.UUID, float] = {}  # one backend process: a soft per-session throttle


async def run_student_code(db: AsyncSession, s: LearningSession, files_in: dict[str, str]) -> dict[str, Any]:
    await lock_session(db, s)
    if s.status != "active":
        raise AppError(ErrorCode.SESSION_NOT_READY, "Запуск доступен, пока сессия активна.")
    _run, spec = await load_spec(db, s)
    if not isinstance(spec, CodeSpec):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Запуск кода доступен только в задачах на программирование.")
    files = {
        **((s.documents_state or {}).get("answers", {}).get("files") or {}),
        **check_code_files(spec, {"files": files_in}),
    }
    now = time.monotonic()
    wait = RUN_INTERVAL_SEC - (now - _last_run.get(s.id, -math.inf))
    if wait > 0:
        sec = math.ceil(wait)
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Следующий запуск через {sec} с.", {"retry_after_sec": sec})
    _last_run[s.id] = now
    async with get_code_runner().box() as box:
        ex = await run_cases(box, spec, files.get("solution.py", ""), "examples", 5)
        tests = await run_student_tests(box, files.get("test_solution.py", ""), files.get("solution.py", ""))
    results = ex.get("results") or [{"got": None, "error": ex["error"], "ok": False}] * len(spec.examples)
    examples = [
        {
            "call": f"{spec.func}({', '.join(repr(a) for a in e.args)})",
            "expected": e.expected,
            "got": r["got"],
            "error": r["error"],
            "ok": r["ok"],
        }
        for e, r in zip(spec.examples, results, strict=False)
    ]
    state = dict(s.documents_state or {})
    state["answers"] = {"files": files}  # a run also saves the code
    s.documents_state = state
    ok_ex = sum(1 for e in examples if e["ok"])
    summary = f"▶ запуск: примеры {ok_ex} из {len(examples)}, тесты {tests.get('passed', 0)} из {tests.get('total', 0)}"
    record_event(db, s, "command", {"cmd": summary}, push=False)
    await touch(db, s)
    await db.commit()
    return {
        "examples": examples,
        "examples_error": ex["error"],
        "tests": {k: tests.get(k) for k in ("total", "passed", "failures", "import_error")},
        "stdout": (ex.get("stdout") or "")
        + ("\n" if ex.get("stdout") and tests.get("stdout") else "")
        + (tests.get("stdout") or ""),
        "retry_after_sec": RUN_INTERVAL_SEC,
    }
