"""Synthetic Utah profile seeder.

Loads `backend/data/seed/nucleus_seed.json` on app startup and inserts every
talent + startup if the tables are empty. Persistent across `docker compose
down -v` because the JSON is in the repo, not the volume.

To add more profiles: edit the JSON, restart the app — the tables will be
empty after a hard reset, so seeding re-runs.

To force a re-seed without deleting the container: truncate both tables, then
restart the app.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.startup import StartupCreate
from app.model.schema.talent import TalentCreate

logger = settings.logger

# data/seed/nucleus_seed.json sits at <backend>/data/seed/nucleus_seed.json.
# This module is at <backend>/app/seed/utah_synthetic.py, so go up two levels.
SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "seed" / "nucleus_seed.json"


def _load_seed_file() -> dict[str, list[dict[str, Any]]]:
    if not SEED_PATH.exists():
        logger.warning(f"Seed file not found at {SEED_PATH} — skipping seed")
        return {"talents": [], "startups": []}
    with SEED_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)
    talents = data.get("talents", [])
    startups = data.get("startups", [])
    logger.info(f"Loaded seed file: {len(talents)} talents, {len(startups)} startups")
    return {"talents": talents, "startups": startups}


async def seed_if_empty(session: AsyncSession) -> dict[str, int] | None:
    """Insert seed data iff both Talent and Startup tables are empty.

    Returns counts on success, None if seeding was skipped (data already exists).
    """
    talent_count = (
        await session.execute(select(Talent).limit(1))
    ).scalar_one_or_none()
    startup_count = (
        await session.execute(select(Startup).limit(1))
    ).scalar_one_or_none()

    if talent_count is not None or startup_count is not None:
        return None

    seed = _load_seed_file()
    if not seed["talents"] and not seed["startups"]:
        return None

    inserted = {"talents": 0, "startups": 0}

    for talent_dict in seed["talents"]:
        # Validate via Pydantic so a bad row raises early with a clear message.
        validated = TalentCreate.model_validate(talent_dict)
        session.add(Talent(**validated.model_dump(mode="json")))
        inserted["talents"] += 1

    for startup_dict in seed["startups"]:
        validated = StartupCreate.model_validate(startup_dict)
        session.add(Startup(**validated.model_dump(mode="json")))
        inserted["startups"] += 1

    await session.commit()
    return inserted
