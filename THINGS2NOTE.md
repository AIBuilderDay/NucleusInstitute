# THINGS2NOTE — Stuff That Doesn't Live in PLAN.md

> Hand-off notes for future sessions. PLAN.md captures *what* we're building; this captures
> *what could bite us* and *why we made the choices we made*.

---

## User preferences (lessons learned)

- **Vanilla rule-filters first. Embeddings are skeptical.** Explainability beats raw similarity for this product. Lead with structured-field scoring, named dimensions, human-readable reasons. Embeddings are a complement, never the primary matcher.
- **uv only, never pip.** All install/sync/run goes through `uv add`, `uv sync`, `uv run`. No pip, no poetry, no pipx.
- **Be verbose in data models, even when fields aren't used in v1.** Better to store a column we don't read yet than migrate later. The "Used by Phase 1?" column in the data card section of PLAN.md is the source of truth for what's wired vs. parked.
- **Keep PLAN.md alive.** Plan updates happen *as decisions change*, not at the end. Tick checkboxes as work completes; append to the changelog at the bottom.
- **Piece-by-piece progress, with TodoWrite tracking.** User asked for it explicitly.

---

## Code-level gotchas

### Nothing has been executed yet (as of phase 1 mid-build)
The whole backend compiles in my head, but no `uv sync`, no Postgres up, no uvicorn run at the time these notes were written. **Don't trust "it should work" — verify with a curl.** First real run will surface real integration bugs.

### JSON mutation hazard
SQLAlchemy does NOT track in-place mutations of `JSON` columns (was `JSONB` under Postgres; same hazard with the SQLite-backed `JSON` we use now). This will silently lose updates:

```python
talent.skills.append("python")
await session.commit()  # ← change is NOT persisted
```

Use one of these instead:
```python
talent.skills = [*talent.skills, "python"]            # reassign
# or wrap the column with sqlalchemy.ext.mutable.MutableList
```

Bake this into the talent_service / startup_service when writing update methods.

### SQLite reality check
We're now on SQLite (`backend/data/nucleus.db`, `aiosqlite` driver). Things to know:
- **Single writer.** SQLite serializes writes. Fine for a hackathon demo + one frontend. If we ever spin up worker processes that write concurrently, expect `database is locked` errors.
- **No JSON containment queries.** Postgres JSONB lets you `WHERE skills @> '["python"]'`; SQLite stores `JSON` as TEXT. Phase-1 RuleFilter loads everything into Python and filters in-app, so this is irrelevant today. If we add server-side JSON filtering, swap back to Postgres.
- **`Uuid` storage.** SA 2.0 `Uuid` stores as 32-char hex on SQLite. Querying via raw SQL needs the dashless form.
- **`task clean:all` deletes the DB file.** It's gone — no volume to detach. Generator re-runs on next `task dev`.

### Matcher registry instantiates eagerly
`@register_matcher` calls `cls()` at import time of `app.provider.matching` — fine for `RuleFilterMatcher` because it's stateless. When we add the embedding matcher, **lazy-load the model weights inside `match_*` methods**, not in `__init__`. Otherwise app startup gets slow and tests that import the package pay the cost too.

### Hard-filter score collapse is intentional
When hard filters fail, the surface `score` collapses to `0.0` but `dimension_scores` is still computed and returned. This is deliberate — the gap-analyzer / "you're 80% fit" UI can show *what would unblock the match*. Don't strip the breakdown when blockers exist.

### Investor & service-provider routing through `rule_filter` is a known design gap
`RoleCategory.INVESTOR` and `RoleCategory.SERVICE_PROVIDER` currently fall through to `DEFAULT_WEIGHTS` (role / sector / stage / skills / mission / location / risk). Those dimensions are *wrong* for them:

- **Investor's match criteria** = check_size_fit, sector_focus, stage_focus, lead/follow, utah_only — not skills/availability.
- **Service provider's match criteria** = service_type ∈ startup.services_needed, stages_served, startup_friendly_terms — not role overlap.

Pick a path before any route accepts these role categories:
1. Disallow `investor` / `service_provider` through `rule_filter` and route them to dedicated future matchers (`venture_matcher`, `service_matcher`).
2. OR extend RuleFilter with role-category-conditional *dimension sets*, not just weight overrides.

### Unverified imports / signatures
I wrote `python_sentry_logger_wrapper.get_logger(name=..., log_level=...)` based on the template's call site, but didn't verify the wrapper's actual API. Same for any psycopg async behavior with JSONB defaults. **Worth a sanity-check on first boot.**

### Phase 1 RuleFilter ignores several stored fields
`education`, `certifications`, `prior_titles`, `prior_companies`, `years_experience`, `prior_exits`, `ventures_advised_count` are all stored on the Talent ORM but the rule-filter doesn't read them yet. Decide whether RuleFilter v2 adds an `experience_level` / `pedigree` dimension before the embedding matcher gets to them first.

### `Base` lives in `app/database/connection.py`, not `app/model/database/base.py`
Mirroring the template. The plan was originally going to put it in `model/database/base.py` but I followed the template layout. Don't add a duplicate `base.py`.

---

## Decisions worth knowing later

- **JSONB-for-everything for list/nested fields** is a hackathon-speed choice. Postgres GIN indexes still let us do contains-queries on JSONB if filtering performance becomes an issue. Long-term, consider normalizing `skills` and `roles_needed` into proper join tables for analytics.
- **Skipped from the HEAL FastAPI template:** 1Password loader (use `NUCLEUS` vault when re-enabled), JWT auth, Sentry DSN wiring (logger is wired, but no DSN), Alembic migrations (we use `create_all`). All can be re-added without restructuring — same file layout as the template.
- **`MatchResult` shape is the load-bearing wire contract.** Every future matcher MUST return that exact Pydantic shape — score, passed_hard_filters, dimension_scores, reasons, blockers, matcher. The frontend match card depends on it.
- **Nucleus actually has 5 named networks**, two of which (Venture, Service Provider) weren't in the hackathon spec. Discovered by fetching <https://www.nucleusutah.org/contact>. The data model now reflects all five.

---

## First-run checklist (when we resume)

1. `cd backend && uv sync`
2. Spin up Postgres (no docker-compose written yet — needed).
3. Copy `.env.example` → `.env`, fill DB creds.
4. `uv run uvicorn app.main:app --reload` — watch for import errors, especially around `python_sentry_logger_wrapper`.
5. Hit `GET /health` — confirms app boot.
6. POST a talent + startup via the seed script or curl, hit `/match/talent/{id}`, verify ranking + reasons make sense.
7. If anything fails: don't paper over with try/except. Find the root cause.
