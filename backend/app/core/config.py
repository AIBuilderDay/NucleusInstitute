"""Application configuration loaded from `.env` via Pydantic settings.

Mirrors the HEAL FastAPI template (`fastapi-1password-template`):
- 1Password vault-loaded `.env` is the eventual prod path (use the `NUCLEUS` vault
  in the HEAL Engineering 1P org). For the hackathon we read plain `.env`.
- Logging goes through `python_sentry_logger_wrapper.get_logger` so any future
  Sentry DSN added to `.env` automatically routes errors to Sentry.
"""

from typing import Any
from urllib.parse import quote_plus

from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from python_sentry_logger_wrapper import get_logger


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # App identity
    # -------------------------------------------------------------------------
    app_name: str = "Nucleus Backend"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "info"

    # -------------------------------------------------------------------------
    # Postgres
    # -------------------------------------------------------------------------
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "nucleus"
    db_password: str = "nucleus"
    db_name: str = "nucleus"

    @property
    def database_url(self) -> str:
        """Async psycopg URL for SQLAlchemy 2.0+."""
        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        return f"postgresql+psycopg://{user}:{password}@{self.db_host}:{self.db_port}/{self.db_name}"

    # -------------------------------------------------------------------------
    # Matching algorithm selection. Overridable per-request via `?matcher=...`.
    # See PLAN.md §2a for the full registry contract.
    # -------------------------------------------------------------------------
    default_matcher: str = "rule_filter"

    # -------------------------------------------------------------------------
    # CORS — comma-separated list of allowed origins for the frontend.
    # -------------------------------------------------------------------------
    cors_allow_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    # -------------------------------------------------------------------------
    # Bootstrap behavior. When true, `init_db()` will load synthetic Utah
    # talent + startup profiles if the tables are empty.
    # -------------------------------------------------------------------------
    seed_on_startup: bool = True

    # -------------------------------------------------------------------------
    # Sentry (optional — wire later, all fields tolerate absence).
    # -------------------------------------------------------------------------
    sentry_dsn: str | None = None
    sentry_environment: str | None = None
    sentry_sample_rate: float = 1.0

    # -------------------------------------------------------------------------
    # Logger handle, populated below so callers can `from app.core.config import settings; settings.logger.info(...)`.
    # -------------------------------------------------------------------------
    logger: Any | None = None


settings = Settings()
settings.logger = get_logger(
    name="nucleus",
    log_level=settings.log_level,
)
