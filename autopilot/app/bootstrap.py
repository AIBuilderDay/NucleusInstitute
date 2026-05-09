"""Ensure HEAL Engineering exists in the Nucleus backend before the agent runs."""

from __future__ import annotations

import logging
from typing import Any

from .config import settings
from .nucleus_client import NucleusClient

logger = logging.getLogger("autopilot.bootstrap")

_HEAL_ID_CACHE: str | None = None


async def ensure_heal_startup(client: NucleusClient) -> str:
    """Find or create the HEAL Engineering startup row. Returns its UUID."""
    global _HEAL_ID_CACHE
    if _HEAL_ID_CACHE:
        return _HEAL_ID_CACHE

    try:
        startups = await client.list_startups()
    except Exception as e:
        raise RuntimeError(
            f"Cannot reach Nucleus backend at {client.base_url}: {e}. "
            "Start it with `task dev` from the repo root."
        ) from e

    for s in startups:
        if (s.get("name") or "").strip().lower() == settings.heal_name.strip().lower():
            _HEAL_ID_CACHE = s["id"]
            logger.info(f"Found existing {settings.heal_name} startup: {_HEAL_ID_CACHE}")
            return _HEAL_ID_CACHE

    payload: dict[str, Any] = {
        "name": settings.heal_name,
        "website": settings.heal_website,
        "email": settings.heal_email,
        "one_liner": settings.heal_one_liner,
        "description": (
            "We build AI infrastructure and developer tools that compress the time "
            "from idea to production. Looking for engineers who care about latency, "
            "observability, and great developer experience."
        ),
        "sector": "ai",
        "sectors_secondary": ["software"],
        "origin": "bootstrapped",
        "founded_year": 2025,
        "stage": "seed",
        "funding_status": "seed",
        "total_raised_usd": 1500000,
        "team_size": 4,
        "roles_needed": ["engineer", "cto", "cofounder"],
        "role_categories_open_to": ["operator", "executive", "intern", "student"],
        "availability_open_to": ["full_time", "part_time", "fractional"],
        "urgency": "immediate",
        "comp_offered_type": "salary_plus_equity",
        "comp_min_salary_usd": 130000,
        "comp_max_salary_usd": 220000,
        "comp_max_equity_pct": 1.5,
        "required_skills": ["python", "typescript", "react", "fastapi", "llm", "pytorch"],
        "nice_to_have_skills": ["rust", "kubernetes", "postgres"],
        "location_city": "Salt Lake City",
        "location_state": "UT",
        "remote_ok": True,
        "mission_keywords": ["developer tools", "ai infrastructure", "speed", "automation"],
    }
    created = await client.create_startup(payload)
    _HEAL_ID_CACHE = created["id"]
    logger.info(f"Created {settings.heal_name} startup: {_HEAL_ID_CACHE}")
    return _HEAL_ID_CACHE
