"""Pydantic schemas for the Startup API. See PLAN.md §3 for field rationale."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.model.schema.enums import (
    Availability,
    CheckSize,
    CompType,
    FundingStatus,
    Origin,
    RiskTolerance,
    RoleCategory,
    RoleTitle,
    Sector,
    ServiceType,
    Stage,
    Urgency,
)
from app.model.schema.profile_extension import (
    StartupProfileExtensionResponse,
    StartupProfileExtensionUpsert,
)


class StartupBase(BaseModel):
    # identity
    name: str
    website: str | None = None
    email: str | None = None
    logo_url: str | None = None
    one_liner: str = ""
    description: str = ""

    # sector / origin
    sector: Sector
    sectors_secondary: list[Sector] = Field(default_factory=list)
    origin: Origin = Origin.BOOTSTRAPPED
    founded_year: int | None = None

    # stage / traction
    stage: Stage
    trl_level: int | None = None
    funding_status: FundingStatus = FundingStatus.BOOTSTRAPPED
    total_raised_usd: int = 0
    recent_grants: list[str] = Field(default_factory=list)
    runway_months: int | None = None
    team_size: int = 1
    customer_count: int | None = None
    arr_usd: int | None = None

    # hiring needs
    roles_needed: list[RoleTitle] = Field(default_factory=list)
    role_categories_open_to: list[RoleCategory] = Field(default_factory=list)
    availability_open_to: list[Availability] = Field(default_factory=list)
    hours_per_week_min: int | None = None
    hours_per_week_max: int | None = None
    urgency: Urgency = Urgency.EXPLORING
    board_seats_open: int = 0
    advisor_slots_open: int = 0

    # compensation offered
    comp_offered_type: CompType
    comp_min_salary_usd: int | None = None
    comp_max_salary_usd: int | None = None
    comp_max_equity_pct: float | None = None

    # investor needs
    seeking_investment: bool = False
    target_raise_usd: int | None = None
    target_check_sizes: list[CheckSize] = Field(default_factory=list)
    seeking_lead: bool = False

    # service provider needs
    services_needed: list[ServiceType] = Field(default_factory=list)

    # skills required
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    domain_expertise_needed: list[str] = Field(default_factory=list)

    # location
    location_city: str
    location_state: str = "UT"
    location_metro: str | None = None
    remote_ok: bool = False

    # mission / culture
    mission_keywords: list[str] = Field(default_factory=list)
    risk_profile: RiskTolerance = RiskTolerance.MEDIUM

    # Utah ecosystem
    university_lab_origin: str | None = None
    accelerator_affiliations: list[str] = Field(default_factory=list)
    local_investors: list[str] = Field(default_factory=list)


class StartupCreate(StartupBase):
    pass


class StartupResponse(StartupBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class StartupListResponse(BaseModel):
    items: list[StartupResponse]
    total: int


class StartupFullCreate(StartupBase):
    """Lean profile + optional extended profile in one request."""

    profile_extension: StartupProfileExtensionUpsert | None = None


class StartupFullResponse(StartupResponse):
    """StartupResponse + the extension that was just inserted (if any)."""

    profile_extension: StartupProfileExtensionResponse | None = None
