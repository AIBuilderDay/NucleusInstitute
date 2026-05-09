"""Pydantic schemas for the Talent API.

The schema is deliberately verbose — Phase 1 RuleFilter consumes a subset of fields,
the rest are stored so future matchers (embeddings, agentic) and the frontend match
card can use them without a schema migration. See PLAN.md §3 for the field-by-field
"used by Phase 1?" breakdown.
"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.model.schema.enums import (
    Availability,
    CheckSize,
    CompType,
    InvestorType,
    NucleusNetwork,
    RiskTolerance,
    RoleCategory,
    RoleTitle,
    Sector,
    ServiceType,
    Stage,
)
from app.model.schema.profile_extension import (
    TalentProfileExtensionResponse,
    TalentProfileExtensionUpsert,
)


class Education(BaseModel):
    school: str
    degree: str
    field: str
    graduation_year: int | None = None


class InvestorProfile(BaseModel):
    """Populated when role_category == investor."""

    investor_type: InvestorType
    typical_check_size: CheckSize
    stages_invested: list[Stage] = Field(default_factory=list)
    sectors_focused: list[Sector] = Field(default_factory=list)
    portfolio_size: int = 0
    utah_only: bool = False
    lead_check: bool = False


class ServiceProviderProfile(BaseModel):
    """Populated when role_category == service_provider."""

    service_type: ServiceType
    firm_name: str
    startup_friendly_terms: bool = False
    stages_served: list[Stage] = Field(default_factory=list)
    sectors_served: list[Sector] = Field(default_factory=list)


class TalentBase(BaseModel):
    """Shared fields for create/response. UUIDs + timestamps live on Response only."""

    # identity
    name: str
    email: EmailStr
    linkedin_url: str | None = None
    headline: str = ""
    photo_url: str | None = None

    # role / availability
    role_category: RoleCategory
    role_titles_seeking: list[RoleTitle] = Field(default_factory=list)
    availability: Availability
    hours_per_week_min: int | None = None
    hours_per_week_max: int | None = None
    start_date_earliest: date | None = None
    commitment_months_min: int | None = None

    # expertise
    skills: list[str] = Field(default_factory=list)
    sectors_of_interest: list[Sector] = Field(default_factory=list)
    domain_expertise: list[str] = Field(default_factory=list)
    stage_preference: list[Stage] = Field(default_factory=list)
    years_experience: int = 0
    prior_titles: list[str] = Field(default_factory=list)
    prior_companies: list[str] = Field(default_factory=list)
    prior_exits: int = 0
    ventures_advised_count: int = 0

    # education
    education: list[Education] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)

    # compensation
    comp_expectation_type: CompType
    comp_min_salary_usd: int | None = None
    comp_max_salary_usd: int | None = None
    comp_min_equity_pct: float | None = None
    equity_acceptable: bool = True

    # location
    location_city: str
    location_state: str = "UT"
    location_metro: str | None = None
    remote_ok: bool = False
    willing_to_relocate: bool = False
    time_zone: str = "America/Denver"

    # mission / fit
    mission_keywords: list[str] = Field(default_factory=list)
    risk_tolerance: RiskTolerance = RiskTolerance.MEDIUM
    bio: str = ""

    # Nucleus network
    primary_network: NucleusNetwork
    investor_profile: InvestorProfile | None = None
    service_provider_profile: ServiceProviderProfile | None = None

    # Utah ecosystem
    utah_networks: list[str] = Field(default_factory=list)
    university_affiliations: list[str] = Field(default_factory=list)
    trust_badges: list[str] = Field(default_factory=list)


class TalentCreate(TalentBase):
    pass


class TalentResponse(TalentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class TalentListResponse(BaseModel):
    items: list[TalentResponse]
    total: int


class TalentFullCreate(TalentBase):
    """Lean profile + optional extended profile in one request.

    Used by the unified `POST /talent` endpoint so the frontend can submit
    the whole profile (and trigger embedding pre-compute) in one round trip.
    """

    profile_extension: TalentProfileExtensionUpsert | None = None


class TalentFullResponse(TalentResponse):
    """TalentResponse + the extension that was just inserted (if any)."""

    profile_extension: TalentProfileExtensionResponse | None = None
