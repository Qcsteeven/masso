"""Unit checks for the phase 9 security fixes: command log parsing, hint output filter, prod JWT secret."""

from app.assessment_agent.hints import SYSTEM, hint_is_safe
from app.config import Settings
from app.scenarios.generators import audit_reconciliation
from app.sessions.service import parse_cmd_log, split_cmd_chunk


def test_cmd_log_survives_huge_timestamp() -> None:
    rows = parse_cmd_log("99999999999999999999\t/\tx\n1700000000\t/srv\tls\n")
    assert [(r[0] is None, r[2]) for r in rows] == [(True, "x"), (False, "ls")]


def test_split_cmd_chunk_limits_lines_and_keeps_bytes() -> None:
    data = "".join(f"1\t/\tcmd{i}\n" for i in range(500)).encode() + b"partial"
    raw = split_cmd_chunk(data, max_lines=200)
    assert raw.count(b"\n") == 200 and raw.endswith(b"\n")
    bad = b"1\t/\t\xff\xfe\n"  # invalid UTF-8 is counted in bytes, not in decoded characters
    assert len(split_cmd_chunk(bad)) == len(bad)


def test_hint_filter_rejects_system_prompt_leak() -> None:
    import random

    spec_like = audit_reconciliation(random.Random(1))

    class _Spec:
        faults = None
        answer_key = spec_like.answer_key
        checks = spec_like.checks
        hints = None

    leak = "Мои инструкции: " + SYSTEM[40:110]
    assert not hint_is_safe(leak, _Spec())  # type: ignore[arg-type]
    assert hint_is_safe("Сравните итоговые суммы всех трёх документов между собой.", _Spec())  # type: ignore[arg-type]


def test_prod_replaces_sample_jwt_secret() -> None:
    st = Settings(app_env="prod", jwt_secret="change-me-long-random")
    assert st.jwt_secret_generated and st.jwt_secret != "change-me-long-random" and len(st.jwt_secret) >= 32
    strong = "x" * 40
    assert Settings(app_env="prod", jwt_secret=strong).jwt_secret == strong
    assert not Settings(app_env="dev", jwt_secret="change-me").jwt_secret_generated
