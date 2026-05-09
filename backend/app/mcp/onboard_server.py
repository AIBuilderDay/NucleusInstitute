"""Per-request FastMCP server for the onboarding agent.

Exposes ONE tool: `create_talent_profile(payload)` — accepts a TalentCreate-
shaped dict, validates it, checks email uniqueness, and persists via the
existing TalentService.create() path.

Same per-request pattern as `app.mcp.server.build_mcp_server`: the tool
closes over the request's DAOFactory, identical to how the matcher's tools
close over candidate pools. No HTTP loopback; the call goes straight to
the service layer in-process.
"""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP
from pydantic import ValidationError

from app.dao.factory import DAOFactory
from app.model.schema.talent import TalentCreate
from app.service.talent_service import TalentService


def build_onboard_mcp_server(daos: DAOFactory) -> FastMCP:
    """Build a per-request MCP server bound to this request's DAOFactory."""
    mcp = FastMCP("nucleus-onboard")
    talent_service = TalentService.__new__(TalentService)
    talent_service.dao_factory = daos
    talent_service.talent_dao = daos.get_talent_dao()

    @mcp.tool
    async def create_talent_profile(payload: dict[str, Any]) -> dict[str, Any]:
        """Persist a Talent profile from a structured payload.

        `payload` must conform to the TalentCreate schema. Required fields:
          - name (str), email (valid email), location_city (str)
          - role_category (RoleCategory enum value)
          - availability (Availability enum value)
          - comp_expectation_type (CompType enum value)
          - primary_network (NucleusNetwork enum value)

        All other fields are optional with sensible defaults. List fields
        accept enum string values (e.g. sectors_of_interest=["ai", "fintech"]).

        Returns:
          { "status": "created", "talent_id": "<uuid>", "email": "..." } on success
          { "status": "validation_error", "errors": [...] } if payload is malformed
          { "status": "conflict", "talent_id": "<existing-uuid>", "email": "..." }
            if a Talent with that email already exists (the agent should report
            this to the caller; the schema-changes PR will turn this into upsert).
        """
        try:
            create = TalentCreate.model_validate(payload)
        except ValidationError as exc:
            return {
                "status": "validation_error",
                "errors": exc.errors(include_url=False),
            }

        existing = await talent_service.get_by_email(create.email)
        if existing is not None:
            return {
                "status": "conflict",
                "talent_id": str(existing.id),
                "email": existing.email,
            }

        talent = await talent_service.create(create)
        return {
            "status": "created",
            "talent_id": str(talent.id),
            "email": talent.email,
        }

    return mcp
