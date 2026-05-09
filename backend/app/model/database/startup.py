"""Startup ORM model. JSON for list/nested fields (see talent.py rationale)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class Startup(Base):
    __tablename__ = "startup"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)

    # identity
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    website: Mapped[str | None] = mapped_column(String(500))
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    one_liner: Mapped[str] = mapped_column(String(400), default="")
    description: Mapped[str] = mapped_column(Text, default="")

    # sector / origin
    sector: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    sectors_secondary: Mapped[list[str]] = mapped_column(JSON, default=list)
    origin: Mapped[str] = mapped_column(String(40), default="bootstrapped")
    founded_year: Mapped[int | None] = mapped_column(Integer)

    # stage / traction
    stage: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    trl_level: Mapped[int | None] = mapped_column(Integer)
    funding_status: Mapped[str] = mapped_column(String(40), default="bootstrapped")
    total_raised_usd: Mapped[int] = mapped_column(Integer, default=0)
    recent_grants: Mapped[list[str]] = mapped_column(JSON, default=list)
    runway_months: Mapped[int | None] = mapped_column(Integer)
    team_size: Mapped[int] = mapped_column(Integer, default=1)
    customer_count: Mapped[int | None] = mapped_column(Integer)
    arr_usd: Mapped[int | None] = mapped_column(Integer)

    # hiring needs
    roles_needed: Mapped[list[str]] = mapped_column(JSON, default=list)
    role_categories_open_to: Mapped[list[str]] = mapped_column(JSON, default=list)
    availability_open_to: Mapped[list[str]] = mapped_column(JSON, default=list)
    hours_per_week_min: Mapped[int | None] = mapped_column(Integer)
    hours_per_week_max: Mapped[int | None] = mapped_column(Integer)
    urgency: Mapped[str] = mapped_column(String(40), default="exploring")
    board_seats_open: Mapped[int] = mapped_column(Integer, default=0)
    advisor_slots_open: Mapped[int] = mapped_column(Integer, default=0)

    # compensation offered
    comp_offered_type: Mapped[str] = mapped_column(String(40), nullable=False)
    comp_min_salary_usd: Mapped[int | None] = mapped_column(Integer)
    comp_max_salary_usd: Mapped[int | None] = mapped_column(Integer)
    comp_max_equity_pct: Mapped[float | None] = mapped_column(Float)

    # investor needs
    seeking_investment: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    target_raise_usd: Mapped[int | None] = mapped_column(Integer)
    target_check_sizes: Mapped[list[str]] = mapped_column(JSON, default=list)
    seeking_lead: Mapped[bool] = mapped_column(Boolean, default=False)

    # service provider needs
    services_needed: Mapped[list[str]] = mapped_column(JSON, default=list)

    # skills required
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    nice_to_have_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    domain_expertise_needed: Mapped[list[str]] = mapped_column(JSON, default=list)

    # location
    location_city: Mapped[str] = mapped_column(String(120), nullable=False)
    location_state: Mapped[str] = mapped_column(String(40), default="UT", index=True)
    location_metro: Mapped[str | None] = mapped_column(String(120))
    remote_ok: Mapped[bool] = mapped_column(Boolean, default=False)

    # mission / culture
    mission_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    risk_profile: Mapped[str] = mapped_column(String(20), default="medium")

    # Utah ecosystem
    university_lab_origin: Mapped[str | None] = mapped_column(String(200))
    accelerator_affiliations: Mapped[list[str]] = mapped_column(JSON, default=list)
    local_investors: Mapped[list[str]] = mapped_column(JSON, default=list)

    # meta
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
