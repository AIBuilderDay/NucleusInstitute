"""Canonical vocabulary enums. Used by ORM models, Pydantic schemas, and matchers.

Inspired by:
- The Builder Day hackathon spec (sectors, talent types, startup needs).
- The current Nucleus connection form at https://www.nucleusutah.org/contact, which
  groups members into 5 named networks (operator, mentor, sme_advisor, venture,
  service_provider). We model both individual role categories AND the named
  network so the hub can match Nucleus's full ecosystem.
"""

from enum import StrEnum


class Sector(StrEnum):
    LIFE_SCIENCES = "life_sciences"
    AI = "ai"
    DEFENSE_AEROSPACE = "defense_aerospace"
    CYBER = "cyber"
    ENERGY = "energy"
    ADVANCED_MANUFACTURING = "advanced_manufacturing"
    FINTECH = "fintech"
    SOFTWARE = "software"


class NucleusNetwork(StrEnum):
    """One of the five named Nucleus networks (per nucleusutah.org/contact)."""

    OPERATOR = "operator"
    MENTOR = "mentor"
    SME_ADVISOR = "sme_advisor"
    VENTURE = "venture"
    SERVICE_PROVIDER = "service_provider"


class RoleCategory(StrEnum):
    EXECUTIVE = "executive"
    OPERATOR = "operator"
    STUDENT = "student"
    INTERN = "intern"
    BOARD_MEMBER = "board_member"
    ADVISOR = "advisor"
    MENTOR = "mentor"
    INVESTOR = "investor"
    SERVICE_PROVIDER = "service_provider"
    UNIVERSITY = "university"


class RoleTitle(StrEnum):
    COFOUNDER = "cofounder"
    CEO = "ceo"
    COO = "coo"
    CTO = "cto"
    CFO = "cfo"
    FRACTIONAL_EXEC = "fractional_exec"
    ENGINEER = "engineer"
    SALES = "sales"
    MARKETING = "marketing"
    BIZ_DEV = "biz_dev"
    REGULATORY = "regulatory"
    PRODUCT = "product"
    DESIGN = "design"
    OTHER = "other"


class Stage(StrEnum):
    IDEA = "idea"
    PRE_SEED = "pre_seed"
    SEED = "seed"
    SERIES_A = "series_a"
    GROWTH = "growth"


class Availability(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    FRACTIONAL = "fractional"
    ADVISORY = "advisory"
    INTERNSHIP = "internship"


class CompType(StrEnum):
    SALARY = "salary"
    EQUITY = "equity"
    SALARY_PLUS_EQUITY = "salary_plus_equity"
    FREE = "free"  # mentors


class RiskTolerance(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Origin(StrEnum):
    UNIVERSITY_LAB_UOFU = "university_lab_uofu"
    UNIVERSITY_LAB_BYU = "university_lab_byu"
    UNIVERSITY_LAB_USU = "university_lab_usu"
    BOOTSTRAPPED = "bootstrapped"
    VC_BACKED = "vc_backed"
    GRANT_FUNDED = "grant_funded"


class FundingStatus(StrEnum):
    BOOTSTRAPPED = "bootstrapped"
    GRANTS = "grants"
    PRE_SEED = "pre_seed"
    SEED = "seed"
    SERIES_A = "series_a"
    SERIES_B_PLUS = "series_b_plus"


class Urgency(StrEnum):
    IMMEDIATE = "immediate"
    NEXT_QUARTER = "next_quarter"
    EXPLORING = "exploring"


class ServiceType(StrEnum):
    LEGAL = "legal"
    CREATIVE = "creative"
    OPERATIONAL = "operational"
    TECHNICAL = "technical"
    FINANCIAL = "financial"
    MARKETING = "marketing"
    RECRUITING = "recruiting"


class CheckSize(StrEnum):
    UNDER_25K = "under_25k"
    K25_TO_100K = "25k_100k"
    K100_TO_500K = "100k_500k"
    K500_TO_2M = "500k_2m"
    M2_PLUS = "2m_plus"


class InvestorType(StrEnum):
    ANGEL = "angel"
    VC = "vc"
    FAMILY_OFFICE = "family_office"
    SYNDICATE = "syndicate"
    CORPORATE_VC = "corporate_vc"
