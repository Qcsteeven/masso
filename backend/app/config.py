"""Application settings (environment variables, see .env.example)."""

import secrets
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMMode = Literal["external", "local", "template"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://masso:masso@localhost:5433/masso"
    # a scenario generation holds its connection through dynamic validation: size the pool for concurrent sessions
    db_pool_size: int = 20
    db_max_overflow: int = 40

    jwt_secret: str = "dev-secret-change-me-dev-secret-change-me"  # noqa: S105
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 7
    ws_token_ttl_sec: int = 60
    seed_default_password: str = "masso-demo"  # noqa: S105
    cookie_secure: bool = False
    # failed logins in 15 minutes before a temporary block: per (email, IP) and per IP (raise behind a shared NAT)
    login_max_failures: int = 10
    login_max_failures_per_ip: int = 50

    llm_generation_mode: LLMMode = "external"
    llm_external_base_url: str = ""
    llm_external_api_key: str = ""
    llm_external_chat_model: str = ""
    llm_external_embed_model: str = ""
    llm_local_base_url: str = "http://ollama:11434/v1"
    llm_local_api_key: str = "ollama"
    llm_local_chat_model: str = ""
    llm_local_embed_model: str = "bge-m3"
    llm_timeout_sec: float = 60.0
    # send response_format=json_object (false for providers that reject it, e.g. GigaChat via gpt2giga)
    llm_external_json_mode: bool = True
    llm_local_json_mode: bool = True
    embedding_dim: int = 1024

    instance_id: str = "masso"  # label masso.instance: the reaper touches only its own containers
    sandbox_image: str = "masso/webstack:latest"
    sandbox_max_sessions: int = 20
    sandbox_idle_pause_min: int = 15
    sandbox_expire_hours: int = 24
    sandbox_snapshot_dir: str = "/data/snapshots"
    docker_url: str = "unix:///var/run/docker.sock"

    worker_enabled: bool = True
    worker_tick_sec: float = 5.0

    jwt_secret_generated: bool = False  # set when a weak secret was replaced in prod (see _strong_secret)

    retention_events_days: int = 180
    retention_security_days: int = 365

    @model_validator(mode="after")
    def _strong_secret(self) -> "Settings":
        """In prod a short or sample JWT secret would let anyone forge tokens: replace it with a random one.

        Tokens then do not survive a restart, so the operator sees a warning and sets JWT_SECRET in .env.
        """
        weak = len(self.jwt_secret) < 32 or self.jwt_secret.lower().startswith(("change-me", "dev-secret"))
        if self.app_env == "prod" and weak:
            self.jwt_secret = secrets.token_urlsafe(48)
            self.jwt_secret_generated = True
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
