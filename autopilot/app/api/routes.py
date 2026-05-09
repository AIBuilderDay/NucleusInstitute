"""HTTP routes for the autopilot service.

Frontend (recruiter app) only needs four operations:
  - GET  /config    → load saved instructions / schedule
  - PUT  /config    → save instructions / schedule
  - GET  /runs      → recent run history
  - POST /run-now   → fire the agent immediately
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .. import store
from ..bootstrap import ensure_heal_startup
from ..nucleus_client import NucleusClient
from ..scheduler import execute_run

router = APIRouter()


class ConfigPayload(BaseModel):
    candidate_criteria: str = ""
    email_instructions: str = ""
    structured_filters: dict[str, Any] = Field(default_factory=dict)
    schedule_enabled: bool = False
    cadence_hours: int = 24


@router.get("/config")
async def get_config() -> dict:
    return await store.load_config()


@router.put("/config")
async def put_config(payload: ConfigPayload) -> dict:
    return await store.save_config(
        candidate_criteria=payload.candidate_criteria,
        email_instructions=payload.email_instructions,
        structured_filters=payload.structured_filters,
        schedule_enabled=payload.schedule_enabled,
        cadence_hours=payload.cadence_hours,
    )


@router.get("/runs")
async def list_runs(limit: int = 25) -> dict:
    rows = await store.list_runs(limit=limit)
    return {"runs": rows}


@router.post("/run-now")
async def run_now() -> dict:
    return await execute_run(trigger="manual")


@router.get("/heal")
async def heal_startup() -> dict:
    """Return HEAL Engineering's startup id + brief. Bootstraps on first call."""
    nucleus = NucleusClient()
    try:
        heal_id = await ensure_heal_startup(nucleus)
        startup = await nucleus.get_startup(heal_id)
    finally:
        await nucleus.aclose()
    return {
        "id": heal_id,
        "name": startup.get("name"),
        "one_liner": startup.get("one_liner"),
        "sector": startup.get("sector"),
        "stage": startup.get("stage"),
        "roles_needed": startup.get("roles_needed", []),
        "required_skills": startup.get("required_skills", []),
        "comp_max_salary_usd": startup.get("comp_max_salary_usd"),
    }


@router.get("/contacts")
async def list_contacts() -> dict:
    """List talents we've already emailed (visible in the UI for transparency)."""
    ids = await store.list_contacted_ids()
    return {"contacted_ids": list(ids), "count": len(ids)}
