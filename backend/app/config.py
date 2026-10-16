"""Application settings (environment variables, see .env.example)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

LLMMode = Literal["external", "local", "template"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://masso:masso@localhost:5433/masso"

    jwt_secret: str = "dev-secret-change-me-dev-secret-change-me"  # noqa: S105
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 7
    ws_token_ttl_sec: int = 60
    seed_default_password: str = "masso-demo"  # noqa: S105
    cookie_secure: bool = False

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
    embedding_dim: int = 1024

    sandbox_image: str = "masso/webstack:latest"
    sandbox_max_sessions: int = 20
    sandbox_idle_pause_min: int = 15
    sandbox_expire_hours: int = 24
    sandbox_snapshot_dir: str = "/data/snapshots"
    docker_url: str = "unix:///var/run/docker.sock"

    worker_enabled: bool = True
    worker_tick_sec: float = 5.0

    retention_events_days: int = 180
    retention_security_days: int = 365


@lru_cache
def get_settings() -> Settings:
    return Settings()
