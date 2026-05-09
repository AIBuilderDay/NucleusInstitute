"""Talent ORM model.

Hackathon shortcut: list-of-strings, list-of-enums, and nested sub-records
(InvestorProfile, ServiceProviderProfile, Education[]) are stored as JSON
rather than normalized into join tables. Cross-db generic `JSON` (lands as
TEXT under SQLite, native JSONB if we ever swap back to Postgres).
"""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class Talent(Base):
    __tablename__ = "talent"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)

    # identity
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    headline: Mapped[str] = mapped_column(String(300), default="")
    photo_url: Mapped[str | None] = mapped_column(String(500))

    # role / availability
    role_category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    role_titles_seeking: Mapped[list[str]] = mapped_column(JSON, default=list)
    availability: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    hours_per_week_min: Mapped[int | None] = mapped_column(Integer)
    hours_per_week_max: Mapped[int | None] = mapped_column(Integer)
    start_date_earliest: Mapped[date | None] = mapped_column(Date)
    commitment_months_min: Mapped[int | None] = mapped_column(Integer)

    # expertise
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    sectors_of_interest: Mapped[list[str]] = mapped_column(JSON, default=list)
    domain_expertise: Mapped[list[str]] = mapped_column(JSON, default=list)
    stage_preference: Mapped[list[str]] = mapped_column(JSON, default=list)
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    prior_titles: Mapped[list[str]] = mapped_column(JSON, default=list)
    prior_companies: Mapped[list[str]] = mapped_column(JSON, default=list)
    prior_exits: Mapped[int] = mapped_column(Integer, default=0)
    ventures_advised_count: Mapped[int] = mapped_column(Integer, default=0)

    # education
    education: Mapped[list[dict]] = mapped_column(JSON, default=list)
    certifications: Mapped[list[str]] = mapped_column(JSON, default=list)

    # compensation
    comp_expectation_type: Mapped[str] = mapped_column(String(40), nullable=False)
    comp_min_salary_usd: Mapped[int | None] = mapped_column(Integer)
    comp_max_salary_usd: Mapped[int | None] = mapped_column(Integer)
    comp_min_equity_pct: Mapped[float | None] = mapped_column(Float)
    equity_acceptable: Mapped[bool] = mapped_column(Boolean, default=True)

    # location
    location_city: Mapped[str] = mapped_column(String(120), nullable=False)
    location_state: Mapped[str] = mapped_column(String(40), default="UT", index=True)
    location_metro: Mapped[str | None] = mapped_column(String(120))
    remote_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    willing_to_relocate: Mapped[bool] = mapped_column(Boolean, default=False)
    time_zone: Mapped[str] = mapped_column(String(60), default="America/Denver")

    # mission / fit
    mission_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    risk_tolerance: Mapped[str] = mapped_column(String(20), default="medium")
    bio: Mapped[str] = mapped_column(Text, default="")

    # Nucleus network
    primary_network: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    investor_profile: Mapped[dict | None] = mapped_column(JSON)
    service_provider_profile: Mapped[dict | None] = mapped_column(JSON)

    # Utah ecosystem
    utah_networks: Mapped[list[str]] = mapped_column(JSON, default=list)
    university_affiliations: Mapped[list[str]] = mapped_column(JSON, default=list)
    trust_badges: Mapped[list[str]] = mapped_column(JSON, default=list)

    # meta
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
