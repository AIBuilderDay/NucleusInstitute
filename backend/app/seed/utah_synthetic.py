"""Synthetic Utah profile seeder.

Two data sources, both loaded at app startup when the Talent and Startup tables
are empty:

1. `backend/data/seed/nucleus_seed.json` — hand-curated, hand-tuned profiles
   with personality (real bios, prior companies, exit counts, university
   affiliations). Source of truth for demo-quality examples.
2. `app.seed.generator.build_synthetic_batch` — deterministic procedural
   generator that produces hundreds more Utah-flavored profiles. Same RNG
   seed every boot, so the dataset is reproducible across restarts/tests.

Persistent across `docker compose down -v` because both sources live in the
repo, not the database volume. To force a re-seed without deleting the
container: truncate both tables, then restart the app.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dao.daos.follow_dao import StartupFollowDAO, TalentFollowDAO
from app.model.database.startup import Startup
from app.model.database.startup_profile_extension import StartupProfileExtension
from app.model.database.talent import Talent
from app.model.database.talent_profile_extension import TalentProfileExtension
from app.model.schema.startup import StartupCreate
from app.model.schema.talent import TalentCreate
from app.seed.generator import (
    build_follow_edges,
    build_startup_extension,
    build_synthetic_batch,
    build_talent_extension,
)

logger = settings.logger

# data/seed/nucleus_seed.json sits at <backend>/data/seed/nucleus_seed.json.
# This module is at <backend>/app/seed/utah_synthetic.py, so go up two levels.
SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "seed" / "nucleus_seed.json"


_TALENT_EXT_FIELDS = (
    "id", "name", "email", "linkedin_url", "headline", "role_category",
    "role_titles_seeking", "skills", "sectors_of_interest", "prior_companies",
    "prior_titles", "prior_exits", "years_experience", "university_affiliations",
    "mission_keywords", "bio", "location_city", "location_metro",
    "service_provider_profile",
)
_STARTUP_EXT_FIELDS = (
    "id", "name", "website", "one_liner", "description", "sector",
    "sectors_secondary", "stage", "funding_status", "total_raised_usd",
    "team_size", "founded_year", "origin", "roles_needed", "recent_grants",
    "accelerator_affiliations", "mission_keywords", "location_city",
    "location_metro", "seeking_investment", "target_raise_usd", "seeking_lead",
)


def _talent_to_dict(t: Talent) -> dict[str, Any]:
    return {f: getattr(t, f, None) for f in _TALENT_EXT_FIELDS}


def _startup_to_dict(s: Startup) -> dict[str, Any]:
    return {f: getattr(s, f, None) for f in _STARTUP_EXT_FIELDS}


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
    """Insert seed data into any tables that are still empty.

    Three independent passes — talents+startups together, then talent→talent
    edges, then talent→startup edges — so a DB that was seeded *before* the
    follow graph existed will pick up edges on the next boot without needing
    a wipe-and-restart.

    Returns counts on success, None if everything was already populated.
    """
    inserted = {
        "talents": 0,
        "startups": 0,
        "talent_follows": 0,
        "startup_follows": 0,
        "talent_extensions": 0,
        "startup_extensions": 0,
    }
    talent_follow_dao = TalentFollowDAO(session)
    startup_follow_dao = StartupFollowDAO(session)

    talent_present = (
        await session.execute(select(Talent).limit(1))
    ).scalar_one_or_none() is not None
    startup_present = (
        await session.execute(select(Startup).limit(1))
    ).scalar_one_or_none() is not None

    persisted_talents: list[Talent] = []
    persisted_startups: list[Startup] = []

    if not talent_present and not startup_present:
        seed = _load_seed_file()
        generated = build_synthetic_batch()
        logger.info(
            f"Generated synthetic batch: {len(generated['talents'])} talents, "
            f"{len(generated['startups'])} startups"
        )

        talents = seed["talents"] + generated["talents"]
        startups = seed["startups"] + generated["startups"]

        for talent_dict in talents:
            validated = TalentCreate.model_validate(talent_dict)
            row = Talent(**validated.model_dump(mode="json"))
            session.add(row)
            persisted_talents.append(row)
            inserted["talents"] += 1

        for startup_dict in startups:
            validated = StartupCreate.model_validate(startup_dict)
            row = Startup(**validated.model_dump(mode="json"))
            session.add(row)
            persisted_startups.append(row)
            inserted["startups"] += 1

        await session.commit()
    else:
        # Talent/Startup already seeded; pull existing rows so we can build
        # follow edges against their UUIDs if the follow tables are empty.
        persisted_talents = list(
            (await session.execute(select(Talent))).scalars().all()
        )
        persisted_startups = list(
            (await session.execute(select(Startup))).scalars().all()
        )

    # Seed extended-profile rows if those tables are empty. Independent pass so
    # a DB seeded before this feature existed picks them up on the next boot.
    talent_ext_present = (
        await session.execute(select(TalentProfileExtension).limit(1))
    ).scalar_one_or_none() is not None
    startup_ext_present = (
        await session.execute(select(StartupProfileExtension).limit(1))
    ).scalar_one_or_none() is not None

    if not talent_ext_present and persisted_talents:
        for t in persisted_talents:
            kwargs = build_talent_extension(_talent_to_dict(t))
            session.add(TalentProfileExtension(talent_id=t.id, **kwargs))
            inserted["talent_extensions"] += 1
    if not startup_ext_present and persisted_startups:
        for s in persisted_startups:
            kwargs = build_startup_extension(_startup_to_dict(s))
            session.add(StartupProfileExtension(startup_id=s.id, **kwargs))
            inserted["startup_extensions"] += 1
    if inserted["talent_extensions"] or inserted["startup_extensions"]:
        await session.commit()
        logger.info(
            f"Seeded profile extensions: {inserted['talent_extensions']} talent, "
            f"{inserted['startup_extensions']} startup"
        )

    # Seed follow graph if the tables are empty. Independent of whether we
    # just inserted talents above or pulled them from a prior boot.
    edges_present = await talent_follow_dao.total_count() > 0 or (
        await startup_follow_dao.total_count() > 0
    )
    if not edges_present and persisted_talents:
        talent_index: list[dict[str, Any]] = [
            {
                "id": t.id,
                "role_category": t.role_category,
                "sectors_of_interest": list(t.sectors_of_interest or []),
            }
            for t in persisted_talents
        ]
        startup_index: list[dict[str, Any]] = [
            {
                "id": s.id,
                "sector": s.sector,
                "sectors_secondary": list(s.sectors_secondary or []),
            }
            for s in persisted_startups
        ]
        edges = build_follow_edges(talents=talent_index, startups=startup_index)
        inserted["talent_follows"] = await talent_follow_dao.bulk_insert(
            edges["talent_follows"]
        )
        inserted["startup_follows"] = await startup_follow_dao.bulk_insert(
            edges["startup_follows"]
        )
        logger.info(
            f"Seeded follow graph: {inserted['talent_follows']} talent→talent, "
            f"{inserted['startup_follows']} talent→startup edges"
        )

    if all(v == 0 for v in inserted.values()):
        return None
    return inserted
