# Nucleus Institute — Utah Innovation Connections Hub

> Builder Day hackathon project. AI-powered talent ↔ startup matching for Utah's innovation ecosystem.
> This plan is the source of truth for the **matching algorithm + backend**. Updated as design evolves.

---

## 1. North Star

Match **talent** (executives, operators, students, interns, board members, advisors, mentors) to
**Utah startups** (life sciences, AI, defense/aerospace, cyber, energy, advanced manufacturing, fintech, software)
better than LinkedIn or a job board, with **explainable** match cards.

This plan covers the **backend / matching engine only**. Frontend is a separate project.

---

## 2. Architecture (mirrors `HEAL-Engineering/fastapi-1password-template`)

4-layer pattern, with the matching algorithm abstracted behind a provider interface so we can swap
implementations (rule-filter → embeddings → agentic) without touching routes or services.

```
Route ──► Service ──► DAOFactory ──► DAOs ──► Postgres
                  └─► MatchingProvider (abstract)
                        ├── RuleFilterMatcher    (Phase 1, this slice)
                        ├── EmbeddingMatcher     (TO-DO)
                        ├── AgenticMatcher       (TO-DO)
                        └── HybridMatcher        (TO-DO)
```

### 2a. Hard requirement: pluggable matching algorithms

This is a **first-class requirement**, not a "nice to have." The matching engine MUST be swappable
end-to-end without changing routes, services, schemas, DAOs, or the database. Concretely:

- **Single abstract interface** in `provider/matching/base.py`. Every matcher implements:
  ```python
  class MatchingProvider(Protocol):
      name: str
      async def match_talent_to_startups(
          self, talent: Talent, startups: list[Startup], top_k: int
      ) -> list[MatchResult]: ...
      async def match_startup_to_talent(
          self, startup: Startup, talents: list[Talent], top_k: int
      ) -> list[MatchResult]: ...
  ```
- **Registry pattern** — matchers register themselves under a string key (`"rule_filter"`,
  `"embedding"`, `"agentic"`, `"hybrid"`). `MatchingService` looks them up by key.
- **Selection at three layers** (each overrides the previous):
  1. Env var `DEFAULT_MATCHER` sets the global default.
  2. Per-request query param `?matcher=embedding` overrides per call.
  3. (Future) Per-tenant / per-user preference stored in DB.
- **All matchers return the same `MatchResult` shape** (score, dimension_scores, reasons, blockers)
  so the frontend match card renders identically regardless of backend matcher.
- **Demo bonus path** — `POST /match/talent/{id}/compare` runs **all** registered matchers in
  parallel and returns each one's top-N alongside, so judges can see how rule vs embedding vs
  agentic differ on the same input.

Directory layout (under `backend/`):

```
backend/
├── app/
│   ├── main.py                       # FastAPI app + router registration + lifespan
│   ├── api/
│   │   ├── health.py
│   │   ├── talent.py                 # POST /talent, GET /talent/{id}
│   │   ├── startup.py                # POST /startup, GET /startup/{id}
│   │   └── match.py                  # POST /match/talent/{id}, POST /match/startup/{id}
│   ├── service/
│   │   ├── talent_service.py
│   │   ├── startup_service.py
│   │   └── matching_service.py       # picks a MatchingProvider by key, invokes it
│   ├── provider/
│   │   └── matching/
│   │       ├── base.py               # abstract MatchingProvider + registry
│   │       ├── rule_filter.py        # ← Phase 1 vanilla matcher
│   │       ├── embedding.py          # TO-DO
│   │       └── agentic.py            # TO-DO
│   ├── dao/
│   │   ├── base.py                   # generic BaseDAO[ModelType] with CRUD
│   │   ├── factory.py                # DAOFactory (FastAPI-injected)
│   │   └── daos/
│   │       ├── talent_dao.py
│   │       └── startup_dao.py
│   ├── model/
│   │   ├── database/                 # SQLAlchemy ORM (Mapped[T] + mapped_column)
│   │   │   ├── __init__.py           # imports all models for create_all metadata
│   │   │   ├── talent.py
│   │   │   └── startup.py
│   │   └── schema/                   # Pydantic request/response
│   │       ├── enums.py              # Sector, Role, Stage, Availability, CompType, ...
│   │       ├── talent.py
│   │       ├── startup.py
│   │       └── match.py
│   ├── database/
│   │   └── connection.py             # async engine, session_factory, Base, get_session, init_db
│   ├── core/
│   │   └── config.py                 # plain .env (skip 1Password vault for hackathon)
│   └── seed/
│       └── utah_synthetic.py         # synthetic Utah talent + startup profiles
├── pyproject.toml
└── .env.example
```

**Skipped from template (to save hackathon time):**
- 1Password vault integration → plain `.env`. **If/when we re-add 1Password, use the `NUCLEUS` vault in the HEAL Engineering 1Password org.** Document this in `.env.example` so anyone re-enabling vault loading knows where to look. *(Now wired: `task env:generate` pulls every item in NUCLEUS into `backend/.env`.)*
- JWT auth (matching is the demo, not auth)
- Sentry logger wrapper → stdlib `logging`
- Alembic migrations → SQLAlchemy `create_all` on startup (good enough for 24h)
- **Postgres → SQLite.** Switched in phase 2 — file at `backend/data/nucleus.db`, async via `aiosqlite`, generic `JSON` and `Uuid` SA types. No Docker required. JSON columns now lose Postgres GIN-index potential (parked — not needed at hackathon scale). To re-enable Postgres, swap `DATABASE_URL` back to `postgresql+psycopg://...`, restore `psycopg[pool,binary]` in pyproject, restore docker-compose. Generic `JSON`/`Uuid` work on both backends so ORM code doesn't need to change.

---

## 3. Data Model

> **Inspired by the live Nucleus connection form** at <https://www.nucleusutah.org/contact>.
> The current Squarespace form lets visitors self-identify into one of **five named networks**,
> two of which are NOT in the hackathon brief: investors and service providers. We model both
> so the hub can match the full network Nucleus already operates, not just talent ↔ startup.
>
> The five Nucleus networks (canonical names from their site):
> 1. **Operator Network** — execs / operators looking for full-time or fractional roles
> 2. **Mentor Network** — informal, time-flexible mentorship of founders/students
> 3. **Subject-Matter Expert Advisory Network** — formal advisors in AI / energy / life sciences / aerospace / defense / cyber / advanced manufacturing
> 4. **Venture Network** — angel investors and active VCs focused on Utah deep tech
> 5. **Service Provider Network** — creative / legal / operational / technical service firms supporting startups
>
> Plus the spec's additional types (cofounders, students, interns, board members) which we keep as RoleCategory values.

### Enums (canonical vocabulary — see `model/schema/enums.py`)

| Enum            | Values                                                                                                |
|-----------------|-------------------------------------------------------------------------------------------------------|
| `Sector`        | life_sciences, ai, defense_aerospace, cyber, energy, advanced_manufacturing, fintech, software        |
| `NucleusNetwork`| operator, mentor, sme_advisor, venture, service_provider — primary network the user signed up for     |
| `RoleCategory`  | executive, operator, student, intern, board_member, advisor, mentor, investor, service_provider       |
| `RoleTitle`     | cofounder, ceo, coo, cto, fractional_exec, engineer, sales, marketing, biz_dev, regulatory, other     |
| `Stage`         | idea, pre_seed, seed, series_a, growth                                                                |
| `Availability`  | full_time, part_time, fractional, advisory, internship                                                |
| `CompType`      | salary, equity, salary_plus_equity, free (mentor)                                                     |
| `RiskTolerance` | low, medium, high                                                                                     |
| `Origin`        | university_lab_uofu, university_lab_byu, university_lab_usu, bootstrapped, vc_backed, grant_funded    |
| `FundingStatus` | bootstrapped, grants, pre_seed, seed, series_a, series_b_plus                                         |
| `Urgency`       | immediate, next_quarter, exploring                                                                    |

| `ServiceType`   | legal, creative, operational, technical, financial, marketing, recruiting (for service providers)     |
| `CheckSize`     | under_25k, 25k_100k, 100k_500k, 500k_2m, 2m_plus (for investors)                                      |
| `InvestorType`  | angel, vc, family_office, syndicate, corporate_vc                                                     |

### Sub-records

```python
Education {
  school: str           # "University of Utah"
  degree: str           # "BS", "MS", "PhD", "MBA"
  field: str            # "Bioengineering"
  graduation_year: int | None
}

InvestorProfile {       # populated when role_category == investor
  investor_type: InvestorType
  typical_check_size: CheckSize
  stages_invested: list[Stage]
  sectors_focused: list[Sector]
  portfolio_size: int
  utah_only: bool        # "Utah-focused deep tech investor" per Nucleus site
  lead_check: bool       # leads rounds vs. follows
}

ServiceProviderProfile { # populated when role_category == service_provider
  service_type: ServiceType
  firm_name: str
  startup_friendly_terms: bool   # offers deferred / discounted / equity-for-services
  stages_served: list[Stage]
  sectors_served: list[Sector]
}
```

> **Goal of these cards:** every column listed here is a candidate signal a future matcher
> (rules / embeddings / agent) might use. Phase 1 RuleFilter only consumes a subset; the rest
> are stored so we don't have to migrate the schema later. Frontend will pick which fields to
> render on the match card.

### Talent profile

| Field                       | Type                | Used by Phase 1? | Notes                                                          |
|-----------------------------|---------------------|------------------|----------------------------------------------------------------|
| **— identity —**            |                     |                  |                                                                |
| id                          | uuid                | yes              |                                                                |
| name                        | str                 | display          |                                                                |
| email                       | str                 | display          |                                                                |
| linkedin_url                | str \| None         | display          | source for future profile builder                              |
| headline                    | str                 | display          | one-line "Fractional CFO, life sciences"                       |
| photo_url                   | str \| None         | display          |                                                                |
| **— role / availability —** |                     |                  |                                                                |
| role_category               | RoleCategory        | **yes (rules)**  | drives which scoring weights + filters apply                   |
| role_titles_seeking         | list[RoleTitle]     | **yes**          | positions they want                                            |
| availability                | Availability        | **yes (filter)** | full_time / fractional / advisory / internship                 |
| hours_per_week_min/max      | int                 | future           | e.g. fractional CFOs offer 5–15h/wk                            |
| start_date_earliest         | date \| None        | future           | "available in 4 weeks"                                         |
| commitment_months_min       | int \| None         | future           | mentors might cap at 3                                         |
| **— expertise —**           |                     |                  |                                                                |
| skills                      | list[str]           | **yes**          | normalized lowercase tokens                                    |
| sectors_of_interest         | list[Sector]        | **yes**          |                                                                |
| domain_expertise            | list[str]           | future           | finer than Sector — "GLP-1 receptors", "RF design"             |
| stage_preference            | list[Stage]         | **yes**          | which startup stages they want to plug into                    |
| years_experience            | int                 | future           |                                                                |
| prior_titles                | list[str]           | future           | "VP Sales", "CEO" — for level-matching                         |
| prior_companies             | list[str]           | future           | brand-name signal                                              |
| prior_exits                 | int                 | future           | acquisitions / IPOs as founder/operator                        |
| ventures_advised_count      | int                 | future           | for advisors                                                   |
| **— education —**           |                     |                  |                                                                |
| education                   | list[Education]     | future           | {school, degree, field, year} — Utah-school filter (U/BYU/USU) |
| certifications              | list[str]           | future           | PE license, CPA, FDA regulatory, CISSP, etc.                   |
| **— compensation —**        |                     |                  |                                                                |
| comp_expectation_type       | CompType            | **yes (filter)** | salary / equity / salary+equity / free                         |
| comp_min_salary_usd         | int \| None         | **yes (filter)** | annualized                                                     |
| comp_max_salary_usd         | int \| None         | future           | upper bound for stretch matches                                |
| comp_min_equity_pct         | float \| None       | future           |                                                                |
| equity_acceptable           | bool                | future           | for advisors                                                   |
| **— location —**            |                     |                  |                                                                |
| location_city               | str                 | **yes**          | "Salt Lake City"                                               |
| location_state              | str                 | **yes**          | "UT"                                                           |
| location_metro              | str \| None         | future           | "Wasatch Front"                                                |
| remote_ok                   | bool                | **yes (filter)** |                                                                |
| willing_to_relocate         | bool                | future           |                                                                |
| time_zone                   | str                 | future           | "America/Denver"                                               |
| **— mission / fit —**       |                     |                  |                                                                |
| mission_keywords            | list[str]           | **yes**          | tokens — climate, health, education, defense                   |
| risk_tolerance              | RiskTolerance       | **yes**          | maps to startup stage (idea/pre-seed = high risk)              |
| bio                         | str                 | future (embed)   | free text — primary input for embedding matcher                |
| **— Nucleus network —**     |                     |                  |                                                                |
| primary_network             | NucleusNetwork      | **yes (filter)** | which of the 5 Nucleus networks the user signed up for         |
| investor_profile            | InvestorProfile?    | role-conditional | populated only when role_category == investor                  |
| service_provider_profile    | ServiceProviderProfile? | role-conditional | populated only when role_category == service_provider      |
| **— Utah ecosystem —**      |                     |                  |                                                                |
| utah_networks               | list[str]           | future           | "Kiln Resident", "U Tech Transfer", "Lassonde Alum"            |
| university_affiliations     | list[str]           | future           | "U of U", "BYU", "USU"                                         |
| trust_badges                | list[str]           | future (display) | verified Utah signals — see TO-DO Phase 2                      |
| **— meta —**                |                     |                  |                                                                |
| created_at, updated_at      | datetime            | yes              |                                                                |

### Startup profile

| Field                        | Type                | Used by Phase 1? | Notes                                                          |
|------------------------------|---------------------|------------------|----------------------------------------------------------------|
| **— identity —**             |                     |                  |                                                                |
| id                           | uuid                | yes              |                                                                |
| name                         | str                 | display          |                                                                |
| website                      | str \| None         | display          |                                                                |
| logo_url                     | str \| None         | display          |                                                                |
| one_liner                    | str                 | display          | "AI-driven sepsis diagnostics for ICU teams"                   |
| description                  | str                 | future (embed)   | longer free text — primary input for embedding matcher         |
| **— sector / origin —**      |                     |                  |                                                                |
| sector                       | Sector              | **yes**          | primary core sector focus                                      |
| sectors_secondary            | list[Sector]        | **yes**          |                                                                |
| origin                       | Origin              | future           | university_lab_uofu / byu / usu / bootstrapped / vc / grant    |
| founded_year                 | int                 | future           |                                                                |
| **— stage / traction —**     |                     |                  |                                                                |
| stage                        | Stage               | **yes**          | idea / pre_seed / seed / series_a / growth                     |
| trl_level                    | int \| None         | future           | 1–9, esp. relevant for deep tech                               |
| funding_status               | FundingStatus       | future           | bootstrapped / grants / pre_seed / seed / series_a / series_b+ |
| total_raised_usd             | int                 | future           |                                                                |
| recent_grants                | list[str]           | future           | "NSF SBIR Phase I", "DOE ARPA-E"                               |
| runway_months                | int \| None         | future           | urgency signal                                                 |
| team_size                    | int                 | future           |                                                                |
| customer_count               | int \| None         | future           | traction signal                                                |
| arr_usd                      | int \| None         | future           |                                                                |
| **— hiring needs —**         |                     |                  |                                                                |
| roles_needed                 | list[RoleTitle]     | **yes**          | the spec's "Immediate needs"                                   |
| role_categories_open_to      | list[RoleCategory]  | **yes (filter)** | exec / operator / student / intern / advisor / mentor / board / investor / service_provider |
| availability_open_to         | list[Availability]  | **yes (filter)** | which workstyles they accept                                   |
| hours_per_week_min/max       | int                 | future           | for fractional / advisory roles                                |
| urgency                      | Urgency             | future           | immediate / next_quarter / exploring                           |
| board_seats_open             | int                 | future           |                                                                |
| advisor_slots_open           | int                 | future           |                                                                |
| **— investor needs —**       |                     |                  | (when startup is fundraising)                                  |
| seeking_investment           | bool                | **yes (filter)** | gates investor matching                                        |
| target_raise_usd             | int \| None         | future           |                                                                |
| target_check_sizes           | list[CheckSize]     | future           | check sizes the round can absorb                               |
| seeking_lead                 | bool                | future           |                                                                |
| **— service provider needs —** |                   |                  |                                                                |
| services_needed              | list[ServiceType]   | future           | legal / creative / operational / technical / etc.              |
| **— compensation offered —** |                     |                  |                                                                |
| comp_offered_type            | CompType            | **yes (filter)** | salary / equity / salary+equity / free                         |
| comp_min_salary_usd          | int \| None         | future           | bottom of band (display)                                       |
| comp_max_salary_usd          | int \| None         | **yes (filter)** | used to compare vs talent.comp_min_salary                      |
| comp_max_equity_pct          | float \| None       | future           |                                                                |
| **— skills required —**      |                     |                  |                                                                |
| required_skills              | list[str]           | **yes**          | hard requirements                                              |
| nice_to_have_skills          | list[str]           | **yes**          | scored at half weight                                          |
| domain_expertise_needed      | list[str]           | future           | finer-grained                                                  |
| **— location —**             |                     |                  |                                                                |
| location_city                | str                 | **yes**          |                                                                |
| location_state               | str                 | **yes**          |                                                                |
| location_metro               | str \| None         | future           |                                                                |
| remote_ok                    | bool                | **yes (filter)** |                                                                |
| **— mission / culture —**    |                     |                  |                                                                |
| mission_keywords             | list[str]           | **yes**          |                                                                |
| risk_profile                 | RiskTolerance       | future           | derived from stage but overridable                             |
| **— Utah ecosystem —**       |                     |                  |                                                                |
| university_lab_origin        | str \| None         | future           | "U of U Tech Transfer", "BYU Innovate"                         |
| accelerator_affiliations     | list[str]           | future           | "Kiln", "BoomStartup", "Sorenson Capital"                      |
| local_investors              | list[str]           | future           | known Utah investors on cap table                              |
| **— meta —**                 |                     |                  |                                                                |
| created_at, updated_at       | datetime            | yes              |                                                                |

### Match result

```python
MatchResult {
  startup_id / talent_id,
  score: float,                       # 0.0 - 1.0
  passed_hard_filters: bool,
  dimension_scores: dict[str, float], # e.g. {"sector": 1.0, "role": 0.66, "comp": 0.0}
  reasons: list[str],                 # human-readable "why matched" bullets
  blockers: list[str],                # human-readable hard-filter failures
}
```

The dimension breakdown is what powers the explainable "match card" in the UI.

---

## 4. Matching Algorithm — Phase 1 (RuleFilter)

The **vanilla approach**. No LLMs, no embeddings. Explainable, fast, deterministic.

### Stage A: Hard filters (eliminate, don't score)
A startup is dropped from the candidate list if any of these fail. **Which filters apply
depends on the talent's `role_category`** — e.g. mentors don't care about salary.

| Filter            | Applies when                            | Pass condition                                          |
|-------------------|-----------------------------------------|---------------------------------------------------------|
| Availability      | always                                  | talent's availability ∈ startup's availability_open_to  |
| Role category     | always                                  | talent's role_category ∈ startup's role_categories_open_to |
| Compensation type | role_category ∉ {mentor}                | talent.comp_expectation_type compatible with offered    |
| Min salary        | comp_expectation_type ∈ {salary, salary+equity} | startup.comp_max_salary ≥ talent.comp_min_salary  |
| Location          | always (soft if remote_ok on either)    | same state OR either side remote_ok                     |

### Stage B: Soft scoring (for survivors of Stage A)
Weighted sum across dimensions. Each dimension yields 0.0–1.0; weights sum to 1.0.
Weights are **role-category-specific** (executives care most about role/sector fit; students
care more about learning + sector; mentors only need sector + mission alignment).

Default weights (executive/operator):
```
role_match:        0.25   # talent.role_titles_seeking ∩ startup.roles_needed
sector_match:      0.20   # talent.sectors_of_interest ∩ {startup.sector + secondary}
stage_match:       0.10   # talent.stage_preference ∩ {startup.stage}
skill_match:       0.20   # |talent.skills ∩ startup.required_skills| / |required_skills|
                          # + half-credit for nice_to_have_skills
mission_match:     0.10   # token overlap between mission_keywords lists
location_match:    0.10   # exact city > same state > remote-compatible
risk_alignment:    0.05   # talent.risk_tolerance vs startup.stage (earlier = higher risk)
```

Per-role overrides (define in `rule_filter.py`):
- **mentor**: only sector_match (0.5) + mission_match (0.5). Hard filters are minimal.
- **student / intern**: sector (0.3) + skill (0.2) + mission (0.2) + location (0.2) + role (0.1).
- **advisor**: role (0.3) + sector (0.3) + mission (0.2) + stage (0.2). No salary filter; equity OK.
- **board_member**: stage (0.3) + sector (0.3) + role (0.2) + mission (0.2).

Final score = weighted sum. Reasons are emitted for each dimension that scored ≥ 0.5
("Strong sector overlap: AI"), blockers for hard-filter failures.

---

## 5. Phase 1 Checklist (CURRENT FOCUS)

- [x] Write this plan
- [x] Read remaining template files (DB session, DAO base class, model patterns)
- [x] Scaffold `backend/` directory mirroring template structure
- [x] `pyproject.toml` with deps: fastapi, uvicorn, sqlalchemy, psycopg, pydantic, pydantic-settings, sentry-struct-logger
- [x] `core/config.py` — Pydantic settings using `python_sentry_logger_wrapper.get_logger`
- [x] `database/connection.py` — async engine + session factory + `Base` + `init_db()` (create_all). (Note: `Base` lives here, no separate `model/database/base.py` needed.)
- [x] `model/schema/enums.py` — all enums (incl. NucleusNetwork, ServiceType, CheckSize, InvestorType added after reviewing live nucleusutah.org/contact)
- [x] `model/database/talent.py` — Talent ORM with JSONB for list/nested fields
- [x] `model/database/startup.py` — Startup ORM with JSONB for list/nested fields
- [x] `model/schema/talent.py` — TalentBase / TalentCreate / TalentResponse + Education / InvestorProfile / ServiceProviderProfile sub-records
- [x] `model/schema/startup.py` — StartupBase / StartupCreate / StartupResponse
- [x] `model/schema/match.py` — MatchResult + Talent/Startup match responses + MatchCompareResponse
- [x] `dao/base.py` — generic `BaseDAO[ModelType]`
- [x] `dao/daos/talent_dao.py`, `dao/daos/startup_dao.py`
- [x] `dao/factory.py` — DAOFactory with both DAOs
- [x] `provider/matching/base.py` — abstract `MatchingProvider` + `@register_matcher` decorator + `get_matcher` lookup
- [x] `provider/matching/rule_filter.py` — RuleFilterMatcher (hard filters: availability/role/comp/location; 7-dim soft scoring: role/sector/stage/skills/mission/location/risk; per-role-category weight overrides for mentor/advisor/board/student/intern)
- [x] `provider/matching/__init__.py` — imports rule_filter so registry hydrates on package import
- [x] `service/talent_service.py`, `service/startup_service.py` — CRUD wrappers around DAOs
- [x] `service/matching_service.py` — fetches profiles via DAO, picks provider via registry, calls it, returns ranked list. Includes `compare_*` methods that run all registered matchers in parallel.
- [x] `api/health.py`, `api/talent.py`, `api/startup.py`, `api/match.py` — match.py exposes `/match/talent/{id}`, `/match/startup/{id}`, and `/match/.../compare` for the demo
- [x] `main.py` — FastAPI app, CORS, lifespan that runs `init_db()` + optional seed, registers routers under `/api/v1` (health is unprefixed)
- [x] **Seed JSON** at `backend/data/seed/nucleus_seed.json` — 36 talents (across all 9 RoleCategory values × 8 sectors × all 5 Nucleus networks) + 12 startups (every sector represented, varied stages and needs). Loaded by `app/seed/utah_synthetic.py` on startup if both tables empty. Persistent across `docker compose down -v` because the JSON lives in the repo.
- [x] `docker-compose.yml` at repo root — Postgres 16 on port 5433 (avoids conflict with existing pg on 5432), volume `nucleus_pgdata`, health check.
- [x] `.gitignore` — keeps `.env`, `.venv`, caches out of version control.
- [x] **Smoke test (live):** booted Postgres + uvicorn on `127.0.0.1:8765`, app seeded 36 talents + 12 startups, `/health` returned `available_matchers: ["rule_filter"]`, `/api/v1/match/talent/{id}` ranked HelixCura first for Marcus Chen (life sciences fractional CFO) with full dimension breakdown, BioFortis correctly hard-filtered with `Salary gap: $150,000 > $140,000`, reverse-direction `/match/startup/{id}` and `/compare` both return correct shapes, `/docs` Swagger UI returns 200.

---

## 6. TO-DO (Phase 2+)

These are explicitly **out of scope** for the current slice but listed so we don't lose them.

### Matching algorithms (additional providers)
- [x] **AgenticFilterMatcher** — shipped (§7). Anthropic SDK + in-process FastMCP, score authority stays with rule_filter.
- [x] **EmbeddingMatcher (`embedding`) + EmbeddingBlendedMatcher (`embedding_blended`)** — shipped. `all-MiniLM-L6-v2` (Apache 2.0) running locally, 384-dim unit-normalized vectors. `embedding` score = clamped cosine; `embedding_blended` score = `0.6 * cosine + 0.4 * rule_filter`. Both gate on rule_filter hard filters. Vectors persisted to a `profile_embedding` table keyed on `(entity_type, entity_id, model_name)` with sha256-of-text `source_signature` for cache invalidation; edit a bio → next request re-encodes that row only.
- [x] Configurable provider selection — `?matcher=` query param + `/match/.../compare` endpoint expose all four matchers in parallel.
- [ ] **HybridMatcher** — RuleFilter prefilter → EmbeddingMatcher rerank → optional LLM rerank top-K. (`embedding_blended` already does the prefilter+rerank piece; LLM rerank is the remaining slice.)
- [ ] **Investor / service-provider matcher dimensions** — both role categories currently fall through to default rule_filter weights, which are wrong for them (see THINGS2NOTE). Either route them to dedicated matchers or extend RuleFilter with role-conditional dimension sets.

### Profile features
- [x] **LinkedIn URL → profile builder** — full OAuth flow shipped: `/api/v1/auth/linkedin/login` → callback → `/handoff` (single-use TTL token) → `/api/v1/onboard/agent` (Sonnet 4.6 agent loop populates a Talent in ~7s via the onboarding MCP server).
- [x] **"See more" detail view** — shipped via `TalentProfileExtension` / `StartupProfileExtension` ORM tables + `GET/PUT /api/v1/talent/{id}/profile` and `/api/v1/startup/{id}/profile`. Match payloads stay slim; long-form fields (resume/pitch/references/case studies) load on click.
- [ ] **Returning-user sign-in** — `/onboard/agent` 409s on second sign-in but no LinkedIn-`sub` → Talent lookup endpoint exists yet. Three remaining gaps documented in THINGS2NOTE.
- [ ] Voice / chat onboarding ("Catalyst" pitch from brainstorm) — talk for 5 min, agent extracts structured profile.
- [ ] Reverse-match framing — startups describe a *problem*, candidates describe their *experience*, no resumes/JDs written.
- [ ] Resume upload → profile builder (LinkedIn path covers most cases; raw-resume parsing still TBD).

### Explainability / UX hooks
- [ ] **Gap analyzer** — "you're 80% fit, here's what's missing" (computed from sub-1.0 dimensions; data is already on `MatchResult.dimension_scores`, just needs UI + a tiny synthesis pass).
- [ ] **Utah trust badges** — U Tech Transfer alum, BYU spinout, USU spinout, Kiln resident, etc. (verified via integration with U/BYU/USU sources, or self-reported with verification flag).
- [ ] Match card UI contract — finalize JSON shape with frontend team.

### Utah ecosystem
- [/] **Ecosystem mapping / knowledge graph** — partial. Follow graph (talent→talent, talent→startup) shipped via `TalentFollow` / `StartupFollow` tables + follow/unfollow routes; PageRank service computes scores over both `people_only` and `full_ecosystem` graphs with signature-keyed cache; `/api/v1/talent/{id}/network-score` and `/api/v1/startup/{id}/network-score` expose per-node scores with cohort-relative percentile ranking. Still TODO: shortest-path warm intros, university/patent/funding nodes.
- [ ] Pull public data: U of U / BYU / USU spinout lists, Kiln, Lehi corridor companies (currently synthetic only).

### Integrations (per spec, required for production)
- [ ] **Affinity CRM** sync — webhook out + read sync.
- [ ] **Squarespace** embed widget for the existing connections hub page.
- [/] Replace Typeform with native onboarding flow — partial. LinkedIn-driven agentic onboarding covers the create-profile flow; a generic non-LinkedIn signup path still TBD.

### Infra / quality
- [x] **`Taskfile.yml`** at repo root — `env:generate` (pull from 1Password `NUCLEUS` vault via `scripts/generate-env.sh`), `dev`, `clean`, `clean:all`. All shells use `uv run`.
- [x] 1Password CLI integration — `task env:generate` enumerates the `NUCLEUS` vault and writes `backend/.env`. (`op inject` template variant still possible but the enumeration pattern is sufficient.)
- [ ] JWT auth (template has it, we skipped).
- [ ] Alembic migrations (template has it, we use `create_all`).
- [ ] Backend Dockerfile + docker-compose for full stack (Postgres compose already exists from Phase 1; we run on SQLite by default — see §2 layout note).
- [ ] Real test suite (pytest + httpx async client). `backend/tests/` exists but only contains `__init__.py`.
- [ ] Seed data from public Utah company lists (not synthetic).

---

## 7. Phase 2 — AgenticFilterMatcher (active focus)

> **Why "agentic-filter" and not "agentic"?** This matcher does almost the exact
> same thing as `rule_filter` — same `MatchResult` shape, same scoring engine,
> same dimension_scores. The agent's value-add is **navigating the filter space**:
> if the first cut returns too few strong matches, the agent loosens a dimension
> and retries, the way a human recruiter would. **Score authority stays with
> rule_filter.** The agent only curates which candidates make the top-k and
> writes the narrative `reasons`.

### 7.1 Architecture

```
MatchingService ─► AgenticFilterMatcher (registers as "agentic_filter")
                       │
                       ├─► spins up per-request FastMCP server (in-process)
                       │     bound to: focal entity + candidate pool + rule_filter
                       │
                       ├─► Anthropic SDK tool-use loop (Sonnet 4.6)
                       │     system prompt + 11 MCP tools (see §9.2)
                       │     bounded: max 4 tool calls, max 30 candidates per call
                       │
                       └─► composes final list[MatchResult]
                             score, dimension_scores ← rule_filter (verbatim)
                             reasons                 ← agent narrative
                             matcher                 ← "agentic_filter"
```

**No new HTTP endpoints required.** `/match/talent/{id}?matcher=agentic_filter`
and `/compare` light up automatically once the matcher is registered.

### 7.2 MCP tool surface (11 tools)

Split by **filter schema**, not by NucleusNetwork count, because several networks
share the same filter dimensions and a polymorphic filter object would invite
agent hallucination on conditional fields.

| Tool                       | Returns                                                       | Filter dimensions                                                                                  |
|----------------------------|---------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `find_operators`           | executives, operators, fractional execs, cofounders           | role_titles_seeking, skills, sectors_of_interest, availability, comp_min_salary, location, stage_preference |
| `find_mentors`             | informal, free-of-charge mentors                              | sectors_of_interest, mission_keywords, hours_per_week, location, commitment_months                  |
| `find_advisors`            | formal SME advisors (paid in equity)                          | domain_expertise, sectors_of_interest, equity_acceptable, ventures_advised_count                    |
| `find_board_members`       | board candidates                                              | prior_titles, sectors_of_interest, stage_preference, availability=advisory                          |
| `find_investors`           | angels, VCs, family offices, syndicates, corporate VCs        | investor_type, typical_check_size, stages_invested, sectors_focused, utah_only, lead_check          |
| `find_service_providers`   | legal, creative, operational, technical, financial firms      | service_type, stages_served, sectors_served, startup_friendly_terms                                 |
| `find_students_interns`    | academic-pipeline talent                                      | university (school), field_of_study, availability=internship, sectors_of_interest                   |
| `find_startups`            | startups filtered by what they're open to                     | sector, stages, role_categories_open_to, seeking, services_needed, comp_offered, location, mission_keywords |
| `get_talent(id)`           | full talent profile                                           | —                                                                                                  |
| `get_startup(id)`          | full startup profile                                          | —                                                                                                  |
| `count(entity, filters)`   | candidate count only (cheap probe before committing)          | (matches the find_* tool's filter shape)                                                            |

Each `find_*` tool returns the same compact summary shape — `{id, name, headline,
sector, stage, score, top_reason}` — sorted by rule_filter's score against the
focal entity. Default `limit=20`, hard cap 30 to protect the context window.

### 7.3 Loop budget + system prompt strategy

- **Max 4 tool calls** per match request — hard cap in the matcher loop, not just a soft prompt.
- **Heuristic in system prompt:** "Try a focused filter first. If fewer than `top_k` results have score ≥ 0.6, broaden one filter dimension and retry. Aim for 2–3 calls; 4 is the ceiling. Final answer: a JSON list of `{id, reasons: [...]}` for your top picks, in descending order of fit."
- **Role-routing in prompt:** "Looking for an investor for a startup? → `find_investors`. Looking for a startup for an operator? → `find_startups`." Explicit network-to-tool mapping prevents the agent from picking the wrong tool.
- **Output discipline:** the agent emits structured JSON in its final text turn — the matcher parses it. No tool used for the final answer; that keeps the loop simple and tokens cheap.

### 7.4 File layout

```
backend/app/
├── mcp/
│   ├── __init__.py
│   └── server.py            # build_mcp_server(focal, talents, startups) factory
└── provider/matching/
    ├── agentic_filter.py    # AgenticFilterMatcher(MatchingProvider)
    └── __init__.py          # adds `from . import agentic_filter` so registry hydrates
```

### 7.5 Hard requirements (non-negotiable)

1. **MatchResult contract preserved** — shape is identical to rule_filter output. The frontend match card cannot tell which matcher produced the result without reading the `matcher` field.
2. **Score authority = rule_filter** — agent never invents a `score` or `dimension_scores`. Only `reasons` come from the agent.
3. **Cost ceiling** — max 4 Anthropic API calls per match request (1 initial + up to 3 tool-loop turns). If the agent doesn't converge, return whatever rule_filter would have returned with a synthetic reason `"Fallback: agent budget exhausted, score from rule_filter"`.
4. **Graceful failure** — if `ANTHROPIC_API_KEY` is missing or the API call fails, raise an HTTP 503 with `detail="agentic_filter unavailable"`. Do NOT silently fall back — that hides bugs and confuses `/compare`.
5. **Bounded context** — every `find_*` tool returns at most 30 summary records. Full profile only via `get_*` on demand.

---

## 7a. Discovery API — directory-style "find me X" lookups

Sits alongside `/match/*` and shares the same filter primitives + scoring
engine. Two different problems, two different endpoint families:

| Concern              | `/match/*`                                      | `/discover/*`                                    |
|----------------------|-------------------------------------------------|--------------------------------------------------|
| What it answers      | "Best 5 startups for Marcus" (or vice versa)    | "Find me investors / mentors / peer operators"   |
| Response shape       | Full `MatchResult` (dimension breakdown, blockers) | Flat list of (target, score, top_reason)      |
| Use in UI            | Match card with explainable breakdown           | Directory / browse / "Find investors" button     |
| Matcher selection    | `?matcher=rule_filter` or `agentic_filter`      | Vanilla (rule_filter) only                       |
| Network narrowing    | All role categories jumbled                     | One network at a time                            |

### URL pattern

```
POST /api/v1/discover/from/{talent|startup}/{focal_id}/{target}
```

`target` ∈ {`operators`, `mentors`, `advisors`, `board_members`, `investors`,
`service_providers`, `students_interns`, `startups`} → 16 endpoints total.

### Per-target filter bodies

Body is a typed Pydantic filter (see `app/provider/matching/filters.py`).
Empty body / `{}` is allowed — returns the full filtered network.

| Target              | Filter model            | Key fields                                                                         |
|---------------------|-------------------------|------------------------------------------------------------------------------------|
| `operators`         | `OperatorFilters`       | sectors_of_interest, role_titles_seeking, skills_any, availability, comp_max_min_usd, location_state, remote_ok, stages |
| `mentors`           | `MentorFilters`         | sectors_of_interest, mission_keywords_any, location_state, hours_per_week_max     |
| `advisors`          | `AdvisorFilters`        | domain_expertise_any, sectors_of_interest, equity_acceptable, ventures_advised_count_min |
| `board_members`     | `BoardMemberFilters`    | prior_titles_any, sectors_of_interest, stages                                      |
| `investors`         | `InvestorFilters`       | investor_type, typical_check_size, stages_invested_any, sectors_focused_any, utah_only, lead_check |
| `service_providers` | `ServiceProviderFilters`| service_type, stages_served_any, sectors_served_any, startup_friendly_terms       |
| `students_interns`  | `StudentInternFilters`  | school, field_of_study, availability, sectors_of_interest                          |
| `startups`          | `StartupFilters`        | sector, stages, role_categories_open_to_any, seeking, services_needed_any, location_state, mission_keywords_any |

Each request also takes `?top_k=20` (1–100, default 20).

### Scoring rules

- **talent → startup** / **startup → talent** : `_score_pair(t, s)` via the
  same RuleFilterMatcher singleton `/match/*` uses → ranked by score desc.
  A candidate's score in `/discover` matches its score in `/match`.
- **talent → talent** / **startup → startup** : no (talent, startup) pair
  exists, so we return the network-filtered survivors with `score=0.0`
  sorted alphabetically. The filter has already narrowed by network — peer
  ranking is out of scope until a peer-matcher exists.

### Why vanilla only

The agentic_filter's value-add is *navigating filter dimensions* — broadening
when the first cut is too narrow. For discovery, the user is already supplying
structured filters via the API, so the iteration value disappears. The agent
loop would be ~150 LOC to re-implement constrained to a single network type
when `/match/*?matcher=agentic_filter` already exposes the same agent and the
caller can post-filter by `talent.role_category` if they need to.

If we ever need agentic discovery: add a `target_type` param to
`AgenticFilterMatcher` and let the discovery service delegate (PLAN.md §7).
Don't duplicate the agent loop.

### Implementation map

```
app/
├── api/discovery.py                        16 thin route handlers
├── service/discovery_service.py            orchestration: load focal, filter, score, project
├── model/schema/discovery.py               TalentDiscoveryResponse, StartupDiscoveryResponse
└── provider/matching/
    ├── filters.py                          typed Pydantic filter models + pure filter functions
    └── (filter primitives shared with mcp/server.py — same rule semantics in both surfaces)
```

---

## 8. Open Questions

- [x] **Frontend stack** — Vite + React + TypeScript, same monorepo (`frontend/` next to `backend/`).
- [x] **Postgres** — moved off it. Phase 2 swapped to SQLite (`backend/data/nucleus.db`, async via `aiosqlite`); the docker-compose Postgres setup still works if we need to swap back (see §2 layout note).
- [x] **Multiple matchers in parallel** — yes. `?matcher=` selects, `/match/.../compare` runs all registered matchers and returns side-by-side results.
- [x] **Auth for the hackathon** — LinkedIn OAuth shipped for first-time profile creation; no JWT/session for ongoing API calls. Returning-user sign-in is the next gap (see §6).
- [ ] Are there real Affinity CRM credentials available for the demo, or should integration be stubbed?

---

## 9. Changelog

- **2026-05-08 initial** — plan drafted. Decisions locked: full Postgres + template structure (skip 1P/JWT/Sentry/Alembic), rule-filter matcher first behind abstract provider interface, embeddings + agentic flow in TO-DO, local embedding model when we get to it. Scope of slice 1: profile ingestion + match endpoints, both directions.
- **2026-05-08 expansion** — added explicit "pluggable matchers" requirement (§2a) with registry pattern + uniform `MatchResult` shape. Beefed up data cards with verbose grouped fields (identity / role / expertise / education / compensation / location / mission / Nucleus network / Utah ecosystem / meta). Added `FundingStatus`, `Urgency`, `ServiceType`, `CheckSize`, `InvestorType` enums plus `Education`, `InvestorProfile`, `ServiceProviderProfile` sub-records.
- **2026-05-08 nucleus-network discovery** — fetched live <https://www.nucleusutah.org/contact>; discovered Nucleus actually operates **5 named networks** (operator / mentor / sme_advisor / venture / service_provider) — investors and service providers were missing from the hackathon spec. Added `NucleusNetwork` enum + `investor` / `service_provider` to `RoleCategory` + investor/service-provider needs to Startup card. Inspiration source pinned in §3.
- **2026-05-08 stack pin** — locked `uv` as the only Python toolchain (no pip/poetry/pipx). Locked `python_sentry_logger_wrapper` (PyPI: `sentry-struct-logger`) as the logger to mirror the template. Pinned NUCLEUS as the 1Password vault name in HEAL Engineering 1P org for any future secret loading.
- **2026-05-08 build progress** — completed Phase 1 through RuleFilterMatcher inclusive: scaffold + config + DB connection + ORM (Talent, Startup with JSONB fields) + Pydantic schemas + DAOs + DAOFactory + abstract matcher base with registry + RuleFilterMatcher with hard filters and per-role-category weighted soft scoring. Remaining for slice 1: services, routes, main.py, seed, smoke test.
- **2026-05-08 phase 1 complete** — services + routes + main.py + JSON-backed seeder (36 talents, 12 startups) + docker-compose for Postgres + .gitignore. **Backend running live on 127.0.0.1:8765**; verified end-to-end: hard filters block correctly with explanatory blocker messages, soft scoring ranks intuitively across both directions, `/match/.../compare` returns per-matcher results in parallel, dimension breakdown preserved on blocked matches for the future gap-analyzer UI. Three runtime bugs surfaced and fixed during smoke test (predicted in THINGS2NOTE): `get_logger` signature is `service_name` not `name` and `log_level` is int; missing `pydantic[email]` dep for `EmailStr`; missing `sqlalchemy[asyncio]`/greenlet dep.
- **2026-05-08 phase 2 kickoff** — added procedural synthetic generator (`backend/app/seed/generator.py`, ~330 talents + 120 startups, deterministic `_RNG_SEED=20260508`, emails namespaced under `nucleus-synth.example.com`); wired into `seed_if_empty`. Added root `Taskfile.yml` (4 tasks: `env:generate` / `dev` / `clean` / `clean:all`) and `scripts/generate-env.sh` mirroring the HEAL fastapi-1password-template's enumeration pattern (item title → env var name, `password` field → value, sourced from the `NUCLEUS` vault). Added `ANTHROPIC_API_KEY` to `.env.example` + `core/config.py` ahead of AgenticMatcher work. Fixed wrong `DB_PORT=5432` → `5433` in `.env.example` (matches docker-compose mapping).
- **2026-05-08 phase 2 agentic-filter design** — locked the AgenticFilterMatcher spec (§7). Decisions: split tool surface into 11 named tools (one per match-flow / Nucleus network) rather than one polymorphic `find_talent`, since investor / service_provider filter dimensions don't overlap with operator dimensions; in-process FastMCP (no subprocess); Sonnet 4.6; score authority stays with rule_filter (agent only curates pool + writes narrative reasons); max 4 tool calls per request; bounded summary projection (30 records max per call) to protect context window; `MatchResult` contract preserved verbatim so the frontend match card and `/compare` work unchanged.
- **2026-05-08 phase 2 agentic-filter live** — built and smoke-tested AgenticFilterMatcher end-to-end. New files: `app/mcp/__init__.py`, `app/mcp/server.py` (11 tools, in-process FastMCP, ~530 LOC), `app/provider/matching/agentic_filter.py` (Anthropic SDK manual tool loop, ~280 LOC). Deps: `fastmcp>=3.2.4`, `anthropic>=0.100.0`. Hit one circular import (provider.matching.__init__ → agentic_filter → mcp.server → provider.matching.rule_filter); fixed with a deferred local import of `build_mcp_server` inside `_run`. Live verification on 127.0.0.1:8765: `/health` reports `available_matchers: ["agentic_filter", "rule_filter"]`; `/match/talent/{id}?matcher=agentic_filter` returns top-3 in ~16s with rule_filter scores intact and dramatically richer narrative reasons ("Perfect sector match: life_sciences seed-stage startup in Marcus's home city of Salt Lake City" vs rule_filter's "Sector overlap: life_sciences"); reverse direction surfaced an investor for HelixCura via `find_investors` because the agent noticed `seeking_investment=True` — exact agentic-filter behavior we wanted; `/compare` runs both matchers in parallel and shows same top pick + same score from both, with agent supplying the better narrative.
- **2026-05-09 embedding matchers live** — shipped two new matchers, `embedding` (pure cosine) and `embedding_blended` (`0.6 * cosine + 0.4 * rule_filter`). Backed by `sentence-transformers/all-MiniLM-L6-v2` (Apache 2.0, runs locally on CPU/MPS, no API costs). One `EmbeddingEngine` singleton shared by both — model loads lazily on first match call (THINGS2NOTE warns about eager registry init), `model.encode` wrapped in `asyncio.to_thread` so `/compare` stays non-blocking. Embedding text built from core fields (bio, headline, skills, sectors, mission) plus `bio_extended`/`highlights`/`projects` from `TalentProfileExtension` and `description_extended`/`highlights` from `StartupProfileExtension` when present (one batch query per entity type per call — no N+1). New persistence layer: `profile_embedding` ORM table + DAO, keyed on `(entity_type, entity_id, model_name)` with sha256-of-text `source_signature` so any edit (bio, extension, highlights) invalidates exactly that one row's cache. Two-layer cache: in-process L1 dict + DB L2. Smoke test on Marcus Chen (executive, life-sciences fractional CFO): rule_filter ranks HelixCura #1 (structured overlap), `embedding` ranks VitaCell Bio #1 (closest free-text alignment), `embedding_blended` ranks CuraLabs Bio #1 with HelixCura #2 (blend pulls structured-strong matches back up). Cold first run with model download + 133 encodes = 25s; warm reruns = 3ms. `dimension_scores` carries through rule_filter's 7 dims plus a new `semantic_similarity` entry; `reasons` gets a leading `"Strong semantic alignment (cosine X.XX)"` when cosine ≥ 0.55. Default matcher stays `rule_filter`; flip via `DEFAULT_MATCHER=embedding_blended` or `?matcher=...`.
- **2026-05-09 extended profile tables** — split long-form fields off the core Talent/Startup ORM into `TalentProfileExtension` / `StartupProfileExtension` (one-to-one, lazy-loaded). Resume URL/text, pitch deck URL/text, references, case studies, plus a free-form `notes` JSON column. Endpoints: `GET/PUT /api/v1/talent/{id}/profile` and `GET/PUT /api/v1/startup/{id}/profile`. `/match` payloads stay slim — long-form data only travels when the user clicks "see more". Generator + seeder fill these so the demo shows real depth on click.
- **2026-05-09 LinkedIn OAuth + agentic onboarding live** — full create-profile-from-LinkedIn flow shipped end-to-end. `app/core/linkedin_oauth.py` (PKCE + signed state cookie), `app/core/oauth_state.py`, `app/core/handoff_cache.py` (in-process single-use TTL token), `app/api/auth.py` (`/auth/linkedin/login`, `/callback`, `/handoff`), `app/api/onboard.py` (`/onboard/agent`), `app/service/onboard_service.py`, `app/mcp/onboard_server.py` (MCP tools the onboarding agent uses to populate a Talent). Agent runs Sonnet 4.6, takes ~7s to build a fully-populated Talent from LinkedIn userinfo + headline. Three known gaps captured in THINGS2NOTE: returning-user sign-in (no `linkedin_sub` → Talent lookup yet), client-trusts-userinfo on `/onboard/agent`, and in-process handoff cache breaks on multi-worker deploys.
- **2026-05-09 follow graph + PageRank + network-score** — added directed follow graph: `TalentFollow` (talent → talent) and `StartupFollow` (talent → startup), DAOs with edge-listing methods, follow/unfollow routes on talent (`/api/v1/talent/{id}/follow/{talent|startup}/{target_id}`, `/following`, `/followers`), follower listing on startup. `app/service/pagerank_service.py` computes PageRank over two graphs — `people_only` (talent nodes only) and `full_ecosystem` (talent + startup) — via dense numpy power iteration with dangling-node redistribution (BYU ACME formulation, d=0.85, 100 iter cap, 1e-7 tol). Cache keyed on `(talent_count, startup_count, talent_edge_count, startup_edge_count)` so any mutation invalidates automatically; `asyncio.Lock` guards first-caller recompute. `/api/v1/talent/{id}/network-score` and `/api/v1/startup/{id}/network-score` return both graph scores plus cohort-relative percentile bucketing via `network_service.py`. Powers the future "warm intro" / "well-connected operators" surfaces and gives the discovery cards a credibility signal beyond rule_filter score.
- **2026-05-09 unified profile create + seeder extension fill** — collapsed `POST /api/v1/talent` and `POST /api/v1/startup` into one-shot endpoints that accept the lean fields plus an optional `profile_extension` block. New schemas `TalentFullCreate`/`TalentFullResponse` (and startup mirrors) extend the existing base/response so old callers keep working — `profile_extension` is null when omitted. Atomic transaction via `BaseDAO.add()` (flush-only) + `DAOFactory.commit()` so a failure on either insert rolls the whole thing back; `TalentService.create_with_profile` / `StartupService.create_with_profile` own the orchestration. Embedding pre-compute moved into a FastAPI `BackgroundTasks` job (`prewarm_talent_embedding` / `prewarm_startup_embedding` in `provider/matching/embedding.py`) — best-effort, errors logged + swallowed because the matcher's L2 cache will lazy-compute on first `/match` anyway. Existing `PUT /{id}/profile` routes still work for editing the extension after creation. Backfilled the seeder so every synthetic + curated talent (366) and startup (132) gets a populated extension on boot: `build_talent_extension` / `build_startup_extension` synthesize bio_extended from lean fields, plug in real working image URLs (`i.pravatar.cc` keyed on email, `api.dicebear.com/shapes` for startup logos, `picsum.photos` for covers), generate 1–3 plausible side-projects per talent from sector pools, and probabilistically fill optional fields (resume/pitch URLs at 50–55%, github/twitter at 35–60%) so the data doesn't look uniform. Stable per-entity RNG seeded from email/name (md5 → int — Python's `hash()` is randomized per-process and would shift the dataset every boot) so the same person renders the same profile across reboots. Independent seeder pass keyed on "extension table empty?" so a DB seeded before this feature picks them up on next boot. Smoke-tested via `TestClient` with stubbed engine: lean-only POST returns 201 with `profile_extension: null`, full POST returns the extension inline, duplicate email → 409, malformed enum → 422, background embedding task fires after each successful create.
- **2026-05-09 discovery API live** — added `/api/v1/discover/from/{talent|startup}/{focal_id}/{target}` for all 8 network types from both perspectives (16 endpoints total). Closes the gap where `/match/startup/{id}` returned all role categories jumbled together — frontend can now ask discrete questions like "find investors for HelixCura" or "find peer mentors for Marcus" and get a flat directory-style list with rule_filter score + one-line reason. New files: `app/provider/matching/filters.py` (typed Pydantic filter models + pure filter primitives, ~250 LOC, extracted from the MCP server's inner closures so both surfaces share rule semantics), `app/model/schema/discovery.py` (response shapes), `app/service/discovery_service.py` (orchestrates filter + score + project, vanilla-only, ~150 LOC), `app/api/discovery.py` (16 thin REST handlers). Refactored `app/mcp/server.py` filter wrappers to delegate to the shared primitives — drops ~120 LOC of duplication, MCP `count` tool and `find_*` tools both use the same `filters.filter_*` functions now. Discovery is rule_filter only by design (PLAN.md §2a still applies — agentic flows live on `/match/*?matcher=agentic_filter`); peer-discovery (talent→talent, startup→startup) returns score=0.0 sorted alphabetically since rule_filter has no (talent, startup) pair to score against. Live smoke-test on 127.0.0.1:8765: all 16 endpoints return 200 with sensible content; HelixCura focal correctly surfaces Beatriz Gutierrez as top operator (score 0.67, "Sector overlap: life_sciences"), Mae Hernandez as top mentor (0.83), Sophie Soto as top advisor (0.80), Hassan Ellis as top investor (0.45); existing `/match` rule_filter and agentic_filter both still pass after the MCP refactor.
