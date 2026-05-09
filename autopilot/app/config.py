"""Autopilot service settings — loaded from .env in the autopilot/ directory."""

from __future__ import annotations

import logging
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_REPO_ROOT = Path(__file__).resolve().parents[2]
_ROOT_ENV = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    # Single shared env at the repo root — same file backend/ reads. Written
    # by `task env:generate` from the NUCLEUS 1Password vault.
    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    nucleus_backend_url: str = "http://127.0.0.1:8765"
    autopilot_port: int = 8766
    autopilot_db_url: str = "sqlite+aiosqlite:///./data/autopilot.db"
    autopilot_tick_minutes: int = 1

    heal_name: str = "Heal Engineering"
    heal_email: str = "hire@heal.engineering"
    heal_website: str = "https://heal.engineering"
    heal_one_liner: str = "AI-driven engineering tooling for high-velocity teams."

    cors_allow_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


settings = Settings()

# Stdlib logger is enough — this service is small and self-contained.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("autopilot")
