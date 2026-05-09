"""Application configuration loaded from `.env` via Pydantic settings.

Mirrors the HEAL FastAPI template (`fastapi-1password-template`):
- 1Password vault-loaded `.env` is the eventual prod path (use the `NUCLEUS` vault
  in the HEAL Engineering 1P org). For the hackathon we read plain `.env`.
- Logging goes through `python_sentry_logger_wrapper.get_logger` so any future
  Sentry DSN added to `.env` automatically routes errors to Sentry.
"""

import logging
from typing import Any

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
    # Database — SQLite via aiosqlite. Path is relative to backend/ (the
    # cwd uvicorn runs in via `task dev`). Override with a full URL like
    # `sqlite+aiosqlite:////absolute/path/nucleus.db` if you want.
    # -------------------------------------------------------------------------
    database_url: str = "sqlite+aiosqlite:///./data/nucleus.db"

    # -------------------------------------------------------------------------
    # Matching algorithm selection. Overridable per-request via `?matcher=...`.
    # See PLAN.md §2a for the full registry contract.
    # -------------------------------------------------------------------------
    default_matcher: str = "rule_filter"

    # -------------------------------------------------------------------------
    # Anthropic API — required for the AgenticMatcher (Phase 2). Optional so
    # the app boots without it; AgenticMatcher will refuse to run if missing.
    # -------------------------------------------------------------------------
    anthropic_api_key: str | None = None

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
    # LinkedIn OAuth (Sign-In with LinkedIn / OpenID Connect).
    # Register an app at https://www.linkedin.com/developers/apps and add the
    # "Sign In with LinkedIn using OpenID Connect" product. The redirect URI
    # MUST match exactly between LinkedIn console and `linkedin_redirect_uri`.
    # Rich-profile scopes (positions, education, skills) are gated by the
    # Marketing Developer Platform; we use OIDC + a resume-paste textbox to
    # feed the onboarding agent richer data without app-review.
    # -------------------------------------------------------------------------
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = "http://localhost:8000/api/v1/auth/linkedin/callback"
    linkedin_scopes: str = "openid profile email"

    # -------------------------------------------------------------------------
    # Google OAuth (Sign-In with Google / OpenID Connect).
    # Create an OAuth 2.0 Client ID in https://console.cloud.google.com/apis/credentials
    # under "APIs & Services -> Credentials". Add `google_redirect_uri` to the
    # client's "Authorized redirect URIs" list (must match exactly). Userinfo
    # exposes sub, name, given_name, family_name, picture, email, email_verified,
    # locale — same shape as the LinkedIn OIDC payload, so the onboarding agent
    # can consume either source interchangeably.
    # -------------------------------------------------------------------------
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    google_scopes: str = "openid profile email"

    # HMAC secret for stateless OAuth `state` cookies. Required in non-dev.
    # Shared between LinkedIn and Google flows — they don't collide because the
    # state cookie name is provider-scoped.
    oauth_state_secret: str = ""

    # Where the OAuth callback redirects the browser after stashing the
    # userinfo. The frontend reads `?linkedin_handoff=<token>` (LinkedIn flow)
    # or `?google_handoff=<token>` (Google flow) and calls the matching
    # /auth/<provider>/handoff endpoint to retrieve the userinfo JSON.
    frontend_onboard_url: str = "http://localhost:5173/onboard"

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

# Map our string log_level (info/debug/warning/error) to the int constants
# the wrapper expects. Mirrors fastapi-1password-template/backend/app/core/config.py.
_log_level_map = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
}
_resolved_level = _log_level_map.get(settings.log_level.lower(), logging.INFO)

settings.logger = get_logger(
    service_name=settings.app_name,
    log_level=_resolved_level,
    sentry_dsn=settings.sentry_dsn,
    sentry_environment=settings.sentry_environment,
    sentry_sample_rate=settings.sentry_sample_rate,
)
