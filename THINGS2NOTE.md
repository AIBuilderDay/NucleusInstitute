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
`@register_matcher` calls `cls()` at import time of `app.provider.matching`. `RuleFilterMatcher` and the agentic / embedding matchers all stay cheap to construct — the agentic matcher defers `AsyncAnthropic(...)` to first request, the embedding engine defers `SentenceTransformer(...)` the same way. **If you add a matcher that loads heavy weights or opens connections, defer it to the first match call.** Otherwise app startup pays the cost and so does every test that imports the package.

### Embedding cache invalidation hinges on the source signature
`profile_embedding.source_signature` is a sha256 of the *constructed embedding text* — name, headline, skills, sectors, mission, bio, plus the extension fields the engine splices in. If you change `EmbeddingEngine.talent_text` / `startup_text` (e.g. add a new field to the chunk), every existing row in `profile_embedding` is suddenly stale because the freshly-hashed text won't match. The matcher will quietly re-encode each profile on first read — that's the right behavior, but it means a deploy that touches the text builders pays the encode cost again. If you ever want to avoid that, `task clean:all` deletes the DB; otherwise just let the lazy refill happen.

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

### PageRank cache is in-process and signature-based
`PageRankService._cache` lives at module scope, keyed on `(talent_count, startup_count, talent_edge_count, startup_edge_count)`. Two consequences:
- **Multi-worker deploys recompute per worker.** Each uvicorn worker holds its own cache. Fine at hackathon scale; if we go multi-worker, push the cache to Redis or accept the per-worker recompute cost.
- **Edits that don't change counts won't invalidate.** The signature counts rows, not content — if a `Talent.skills` field gets edited but no follow edges or rows are added, PageRank stays cached (correctly: the graph hasn't changed). But if anyone ever derives PageRank from non-graph fields, they have to widen the signature.

`FollowService` is responsible for calling `PageRankService.invalidate()` after any mutation. If a future code path mutates follow edges directly via the DAO without going through the service, the cache will go stale. Don't bypass the service.

### Network-score cohort buckets are derived per-request, not stored
`/network-score` returns both raw PageRank score and cohort-relative percentile (e.g. "top 10% of operators in life sciences"). The cohort is computed at request time from the cached PageRank scores filtered to the cohort. That's cheap because PageRank is already cached, but it means **changing how cohorts are defined is a code change, not a config change.** If the frontend wants new cohort slices, plumb them through `network_service._graphscore` rather than hacking it client-side.

### Extended profile is a separate table on purpose — don't pre-join
`TalentProfileExtension` / `StartupProfileExtension` are 1:1 with the core ORM but loaded lazily. The whole point is that `/match/*` and `/discover/*` payloads stay small. Resist the temptation to add `selectinload(Talent.profile_extension)` to the matching query path — it'd inflate every match response with resume text. The frontend should only fetch `GET /talent/{id}/profile` when the user clicks "see more" on a card.

### LinkedIn OAuth → onboarding chain: working, but three gaps for non-first-time flows
End-to-end verified via curl on 2026-05-09: `/auth/linkedin/login` mints proper authorize URL + signed state cookie, `/handoff` is single-use TTL pop, `/onboard/agent` builds a fully-populated Talent in ~7s (Sonnet 4.6, agent loop). The only step un-curl-able is the human consent on linkedin.com itself.

For the **first-time create-profile-from-LinkedIn** demo path the backend is sufficient. Three real gaps for everything else:

1. **Returning-user sign-in is unimplemented.** Email is the unique key; `/onboard/agent` 409s on the second sign-in with `{talent_id: ...}` but there's no endpoint that maps LinkedIn `sub` → existing Talent. Need a `users` table (or `linkedin_sub` column on Talent) + a `/auth/linkedin/exchange` (or `/me`) before second-sign-in works. The auth.py docstring already flags this.
2. **`/onboard/agent` trusts whatever `linkedin_userinfo` body the client POSTs.** A determined client could fabricate userinfo and create a profile under any email. To close: have `/onboard/agent` accept the *handoff token* and pop it server-side, OR sign the userinfo on `/handoff` and verify the signature on `/onboard`. Currently the token dies at `/handoff`.
3. **Handoff cache is in-process only** ([handoff_cache.py:8](backend/app/core/handoff_cache.py#L8)). Multiple uvicorn workers → callback lands on worker A, `/handoff` request lands on worker B → 404. Swap for Redis when going multi-process. Already noted in the file.

Also worth knowing: `LINKEDIN_REDIRECT_URI` must match between `backend/.env` (sourced from 1Password NUCLEUS vault), `Taskfile.yml`'s backend port, AND the LinkedIn developer console's authorized redirect URIs. We hit this once when the vault said `:8000` and Taskfile ran on `:8765` — silent until callback time.

---

## Decisions worth knowing later

- **JSONB-for-everything for list/nested fields** is a hackathon-speed choice. Postgres GIN indexes still let us do contains-queries on JSONB if filtering performance becomes an issue. Long-term, consider normalizing `skills` and `roles_needed` into proper join tables for analytics.
- **Skipped from the HEAL FastAPI template:** 1Password loader (use `NUCLEUS` vault when re-enabled), JWT auth, Sentry DSN wiring (logger is wired, but no DSN), Alembic migrations (we use `create_all`). All can be re-added without restructuring — same file layout as the template.
- **`MatchResult` shape is the load-bearing wire contract.** Every future matcher MUST return that exact Pydantic shape — score, passed_hard_filters, dimension_scores, reasons, blockers, matcher. The frontend match card depends on it.
- **Nucleus actually has 5 named networks**, two of which (Venture, Service Provider) weren't in the hackathon spec. Discovered by fetching <https://www.nucleusutah.org/contact>. The data model now reflects all five.

---

## First-run checklist (when we resume)

1. `task env:generate` — pulls every item from the `NUCLEUS` 1Password vault into `backend/.env`. Requires `op` CLI signed in to the HEAL Engineering 1P org.
2. `task dev` — runs `uvicorn app.main:app --reload` on port 8765. Lifespan auto-runs `init_db()` (SQLite `create_all`) and seeds 36 hand-built + ~330 procedurally-generated talents and 12+120 startups if the tables are empty.
3. `GET /health` — confirms app boot. Response includes `available_matchers` so you can see whether `agentic_filter` registered (it skips registration silently if `ANTHROPIC_API_KEY` is missing — check `.env` if you only see `rule_filter`).
4. Hit `/match/talent/{id}`, `/discover/from/talent/{id}/startups`, `/talent/{id}/network-score` to spot-check the three big surfaces.
5. If anything fails: don't paper over with try/except. Find the root cause.

`task clean:all` deletes `backend/data/nucleus.db` — generator re-runs on next `task dev`.
