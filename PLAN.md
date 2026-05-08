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
- 1Password vault integration → plain `.env`. **If/when we re-add 1Password, use the `NUCLEUS` vault in the HEAL Engineering 1Password org.** Document this in `.env.example` so anyone re-enabling vault loading knows where to look.
- JWT auth (matching is the demo, not auth)
- Sentry logger wrapper → stdlib `logging`
- Alembic migrations → SQLAlchemy `create_all` on startup (good enough for 24h)

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
- [ ] **EmbeddingMatcher** — local sentence-transformer model (e.g. `all-MiniLM-L6-v2` via `sentence-transformers`). Embed bio + description + mission, cosine-similarity, blend with rule-filter score.
- [ ] **AgenticMatcher** — Claude with tool-calling. Tools: `filter_by_sector`, `filter_by_stage`, `filter_by_comp`, `search_skills`, `get_startup`, `get_talent`. Agent decides which filters to chain to find the best matches and returns a justification trace.
- [ ] **HybridMatcher** — RuleFilter prefilter → EmbeddingMatcher rerank → optional LLM rerank top-K.
- [ ] Configurable provider selection via query param or env var, so the demo can show all three side-by-side.

### Profile features
- [ ] Voice / chat onboarding ("Catalyst" pitch from brainstorm) — talk for 5 min, agent extracts structured profile.
- [ ] Reverse-match framing — startups describe a *problem*, candidates describe their *experience*, no resumes/JDs written.
- [ ] LinkedIn URL → profile builder.
- [ ] Resume upload → profile builder.

### Explainability / UX hooks
- [ ] **Gap analyzer** — "you're 80% fit, here's what's missing" (computed from sub-1.0 dimensions).
- [ ] **Utah trust badges** — U Tech Transfer alum, BYU spinout, USU spinout, Kiln resident, etc. (verified via integration with U/BYU/USU sources, or self-reported with verification flag).
- [ ] Match card UI contract — finalize JSON shape with frontend team.

### Utah ecosystem
- [ ] **Ecosystem mapping / knowledge graph** — people ↔ companies ↔ universities ↔ patents ↔ funding. Shortest-path warm intros.
- [ ] Pull public data: U of U / BYU / USU spinout lists, Kiln, Lehi corridor companies.

### Integrations (per spec, required for production)
- [ ] **Affinity CRM** sync — webhook out + read sync.
- [ ] **Squarespace** embed widget for the existing connections hub page.
- [ ] Replace Typeform with native onboarding flow.

### Infra / quality
- [ ] JWT auth (template has it, we skipped).
- [ ] Alembic migrations (template has it, we used create_all).
- [ ] Docker compose for local Postgres + backend.
- [ ] Real test suite (pytest + httpx async client).
- [ ] Seed data from public Utah company lists (not synthetic).
- [ ] **`Taskfile.yml`** mirroring the template's `task env:generate` pattern. Tasks: `env:generate` (pull from 1Password `NUCLEUS` vault → `.env`), `dev` (run uvicorn with reload), `db:up` / `db:down` (compose Postgres), `db:reset`, `seed`, `test`, `lint`, `format`. All shells use `uv run` under the hood.
- [ ] 1Password CLI integration — `op inject` template using item refs from the `NUCLEUS` vault. Once added, remove plaintext `.env` from version-control flow entirely.

---

## 7. Open Questions

- [ ] What's the frontend stack and where does it live? (Separate repo? Same monorepo?)
- [ ] Do we have a Postgres instance ready, or do we need docker-compose to spin one up locally?
- [ ] Do we want the API to expose multiple matchers in parallel for the demo (so judges see "rule says X, embeddings say Y, agent says Z"), or one selectable matcher?
- [ ] Are there real Affinity CRM credentials available for the demo, or should integration be stubbed?
- [ ] Do we need user accounts at all for the hackathon demo, or are profiles unauthenticated?

---

## 8. Changelog

- **2026-05-08 initial** — plan drafted. Decisions locked: full Postgres + template structure (skip 1P/JWT/Sentry/Alembic), rule-filter matcher first behind abstract provider interface, embeddings + agentic flow in TO-DO, local embedding model when we get to it. Scope of slice 1: profile ingestion + match endpoints, both directions.
- **2026-05-08 expansion** — added explicit "pluggable matchers" requirement (§2a) with registry pattern + uniform `MatchResult` shape. Beefed up data cards with verbose grouped fields (identity / role / expertise / education / compensation / location / mission / Nucleus network / Utah ecosystem / meta). Added `FundingStatus`, `Urgency`, `ServiceType`, `CheckSize`, `InvestorType` enums plus `Education`, `InvestorProfile`, `ServiceProviderProfile` sub-records.
- **2026-05-08 nucleus-network discovery** — fetched live <https://www.nucleusutah.org/contact>; discovered Nucleus actually operates **5 named networks** (operator / mentor / sme_advisor / venture / service_provider) — investors and service providers were missing from the hackathon spec. Added `NucleusNetwork` enum + `investor` / `service_provider` to `RoleCategory` + investor/service-provider needs to Startup card. Inspiration source pinned in §3.
- **2026-05-08 stack pin** — locked `uv` as the only Python toolchain (no pip/poetry/pipx). Locked `python_sentry_logger_wrapper` (PyPI: `sentry-struct-logger`) as the logger to mirror the template. Pinned NUCLEUS as the 1Password vault name in HEAL Engineering 1P org for any future secret loading.
- **2026-05-08 build progress** — completed Phase 1 through RuleFilterMatcher inclusive: scaffold + config + DB connection + ORM (Talent, Startup with JSONB fields) + Pydantic schemas + DAOs + DAOFactory + abstract matcher base with registry + RuleFilterMatcher with hard filters and per-role-category weighted soft scoring. Remaining for slice 1: services, routes, main.py, seed, smoke test.
- **2026-05-08 phase 1 complete** — services + routes + main.py + JSON-backed seeder (36 talents, 12 startups) + docker-compose for Postgres + .gitignore. **Backend running live on 127.0.0.1:8765**; verified end-to-end: hard filters block correctly with explanatory blocker messages, soft scoring ranks intuitively across both directions, `/match/.../compare` returns per-matcher results in parallel, dimension breakdown preserved on blocked matches for the future gap-analyzer UI. Three runtime bugs surfaced and fixed during smoke test (predicted in THINGS2NOTE): `get_logger` signature is `service_name` not `name` and `log_level` is int; missing `pydantic[email]` dep for `EmailStr`; missing `sqlalchemy[asyncio]`/greenlet dep.
