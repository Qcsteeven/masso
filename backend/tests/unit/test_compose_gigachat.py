"""Deployment contract of the GigaChat proxy (docker-compose.yml, docker-compose.tls.yml)."""

from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[3]


def _service(name: str, file: str = "docker-compose.yml") -> dict[str, Any]:
    svc: dict[str, Any] = yaml.safe_load((ROOT / file).read_text("utf-8"))["services"][name]
    return svc


def test_gpt2giga_is_internal_and_authenticated() -> None:
    svc = _service("gpt2giga")
    env = svc["environment"]
    assert svc["profiles"] == ["gigachat"]
    assert "ports" not in svc  # reachable only by the backend inside the compose network
    assert env["GPT2GIGA_ENABLE_API_KEY_AUTH"] == "True"
    assert env["GPT2GIGA_API_KEY"] == "${LLM_EXTERNAL_API_KEY:-}"
    assert env["GIGACHAT_VERIFY_SSL_CERTS"].endswith(":-True}")  # off only when .env says so (test mode)


def test_gpt2giga_queues_requests_per_model() -> None:
    """GigaChat for individuals answers 429 to a second concurrent request: 2 of 3 parallel generations
    fell back to templates in the load run of 28.10.2026 until the proxy queued them."""
    env = _service("gpt2giga")["environment"]
    assert env["GPT2GIGA_MODEL_MAX_CONNECTIONS_DEFAULT"] == "${GIGACHAT_MAX_CONCURRENCY:-1}"
    assert float(env["GPT2GIGA_MODEL_MAX_CONNECTIONS_ACQUIRE_TIMEOUT"]) < 60  # below LLM_TIMEOUT_SEC


def test_operation_mode_verifies_gigachat_certificate() -> None:
    svc = _service("gpt2giga", "docker-compose.tls.yml")
    assert svc["environment"]["GIGACHAT_VERIFY_SSL_CERTS"] == "True"
    assert svc["environment"]["GIGACHAT_CA_BUNDLE_FILE"] == "/certs/russian_trusted_root_ca.pem"
