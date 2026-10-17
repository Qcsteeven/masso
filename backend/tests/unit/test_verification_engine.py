"""Verification Engine: one case per check type (spec §12 «Автоверификация»), sandbox replaced by a fake."""

from typing import Any

import pytest

from app.sandbox.manager import ExecResult
from app.scenarios.spec import Check
from app.verification.engine import CheckContext, run_check


class FakeSandbox:
    def __init__(self, outputs: dict[str, ExecResult], state: dict[str, Any] | None = None) -> None:
        self.outputs = outputs
        self._state = state or {"status": "running", "restart_count": 0, "oom_killed": False}
        self.calls: list[tuple[str, str]] = []

    async def exec(
        self,
        container_id: str,
        cmd: str | list[str],
        *,
        timeout: float = 30.0,
        user: str = "student",
        workdir: str = "/srv",
    ) -> ExecResult:
        assert user == "student"
        self.calls.append((container_id, str(cmd)))
        for needle, res in self.outputs.items():
            if needle in str(cmd):
                return res
        return ExecResult(127, "not found", 1)

    async def state(self, container_id: str) -> dict[str, Any]:
        return self._state


def _check(type_: str, **params: Any) -> Check:
    return Check(id="c", title="t", type=type_, weight=1, params=params)  # type: ignore[arg-type]


async def _passed(check: Check, sb: FakeSandbox | None = None, answers: dict[str, Any] | None = None) -> bool:
    ctx = CheckContext(container_id="cid" if sb else None, sandbox=sb, answers=answers or {})
    return (await run_check(check, ctx)).passed


async def test_http_health() -> None:
    ok = FakeSandbox({"curl": ExecResult(0, "200", 5)})
    bad = FakeSandbox({"curl": ExecResult(0, "502", 5)})
    assert await _passed(_check("http_health"), ok)
    assert not await _passed(_check("http_health"), bad)
    assert not await _passed(_check("http_health"))  # no sandbox -> fail, not crash


@pytest.mark.parametrize(
    ("params", "result", "expected"),
    [
        ({"cmd": "nginx -t"}, ExecResult(0, "ok", 1), True),
        ({"cmd": "nginx -t"}, ExecResult(1, "emerg", 1), False),
        ({"cmd": "grep trust x", "exit_code": 1}, ExecResult(1, "", 1), True),
        ({"cmd": "ss -ltn", "expect_regex": ":5432"}, ExecResult(0, "LISTEN 0.0.0.0:5432", 1), True),
        ({"cmd": "cat log", "forbid_regex": "FATAL"}, ExecResult(0, "FATAL: password", 1), False),
        ({"cmd": "sleep 99"}, ExecResult(-1, "", 20000, timed_out=True), False),
    ],
)
async def test_docker_exec(params: dict[str, Any], result: ExecResult, expected: bool) -> None:
    sb = FakeSandbox({str(params["cmd"]): result})
    assert await _passed(_check("docker_exec", **params), sb) is expected


async def test_file_diff() -> None:
    sb = FakeSandbox({"cat": ExecResult(0, "DB_USER=shop\nDB_PORT=5432\n", 1)})
    assert await _passed(_check("file_diff", path="/srv/app/.env", contains=["DB_USER=shop"]), sb)
    assert not await _passed(_check("file_diff", path="/srv/app/.env", not_contains=["DB_PORT=5432"]), sb)
    assert await _passed(_check("file_diff", path="/srv/app/my file", contains=["DB_USER"]), sb)
    assert sb.calls[-1][1] == "cat '/srv/app/my file'"  # path is shell-quoted


async def test_docker_inspect() -> None:
    running = FakeSandbox({}, {"status": "running", "restart_count": 0, "oom_killed": False})
    oom = FakeSandbox({}, {"status": "running", "restart_count": 0, "oom_killed": True})
    flapping = FakeSandbox({}, {"status": "running", "restart_count": 3, "oom_killed": False})
    assert await _passed(_check("docker_inspect"), running)
    assert not await _passed(_check("docker_inspect"), oom)
    assert not await _passed(_check("docker_inspect"), flapping)
    assert await _passed(_check("docker_inspect", max_restarts=5), flapping)


async def test_rule_match() -> None:
    found = {"findings": [{"section": "4.2", "defect_type": "penalty_cap"}]}
    assert await _passed(_check("rule_match", defect_type="penalty_cap", section="4.2"), answers=found)
    assert not await _passed(_check("rule_match", defect_type="penalty_cap", section="5"), answers=found)
    assert await _passed(_check("rule_match", field="verdict", expected="reject"), answers={"verdict": "reject"})
    assert not await _passed(_check("rule_match", field="verdict", expected="reject"), answers={})


async def test_numeric_match() -> None:
    c = _check("numeric_match", field="sum", expected=1250.5)
    assert await _passed(c, answers={"sum": "1 250,50"})
    assert not await _passed(c, answers={"sum": 1251})
    assert not await _passed(c, answers={"sum": "абв"})
    assert await _passed(_check("numeric_match", field="d", expected=-500, abs=True), answers={"d": 500})


async def test_semantic_similarity_keywords_without_embeddings() -> None:
    c = _check("semantic_similarity", field="text", reference="Срок 10 дней", must_contain=["10 дней"])
    assert await _passed(c, answers={"text": "Установить срок оплаты 10  дней"})
    assert not await _passed(c, answers={"text": "Срок оплаты разумный"})
    assert not await _passed(c, answers={"text": "   "})


async def test_semantic_similarity_with_embeddings() -> None:
    async def embed(texts: list[str]) -> tuple[list[list[float]], str]:
        return [[1.0, 0.0], [0.99, 0.05] if "похож" in texts[1] else [0.0, 1.0]], "provider"

    c = _check("semantic_similarity", field="text", reference="эталон")
    ctx = CheckContext(answers={"text": "похожий ответ"}, embed=embed)
    res = await run_check(c, ctx)
    assert res.passed and res.judge == "embeddings"
    ctx = CheckContext(answers={"text": "другое"}, embed=embed)
    assert not (await run_check(c, ctx)).passed


async def test_requires_incident_skipped_until_applied() -> None:
    c = _check("http_health", requires_incident="inc1")
    res = await run_check(c, CheckContext())
    assert res.skipped and res.passed
