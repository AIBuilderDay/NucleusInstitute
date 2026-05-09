# Nucleus Institute — Utah Innovation Connections Hub

Builder Day hackathon project. AI-powered talent ↔ startup matching for Utah's
innovation ecosystem.

This repo has two pieces:

```
backend/    FastAPI service — the matching engine and source of truth
frontend/   Single-page HTML demo — disposable UI for poking at the API
```

The serious design lives in [PLAN.md](PLAN.md). This README is the
short "how do I run it" version.

---

## About the frontend

The `frontend/` directory is a **work-in-progress** React 19 + Vite + TypeScript
SPA, styled with Tailwind 4 and managed with pnpm. Page routing is plain
`useState` — no router library yet. It is partially built: `Browse`, `Match`,
`My Profile`, and `Join` (a 3-step onboarding wizard) are wired up against the
real backend, but UX polish, error states, and several flows are still rough.
Expect rough edges; this is not finished.

Field names and shapes come straight from the backend Pydantic schemas in
[backend/app/model/schema/](backend/app/model/schema/) and
[backend/app/model/schema/enums.py](backend/app/model/schema/enums.py) — if a
label looks generated, that's because it is.

---

## Getting started

You need two terminals.

### 1. Backend

```bash
cd backend
uv sync                          # or: pip install -e .
uv run uvicorn app.main:app --reload --port 8765
```

On first boot, the lifespan hook seeds synthetic Utah talent and startups so
there is something to match against. Open <http://localhost:8765/docs> for the
auto-generated Swagger UI if you want to drive the API directly.

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The footer shows whether the backend is reachable.
Override the API base with `VITE_API_BASE_URL` if you're not running the
backend on the default port.

The backend's CORS allowlist
([backend/app/core/config.py](backend/app/core/config.py)) trusts
`http://localhost:5173` and `http://localhost:3000`.

---

## Matchers

Two matchers ship today, registered behind a uniform `MatchResult` contract so
the frontend match card renders identically regardless of source. Pick one per
request with `?matcher=<name>`, or hit `/compare` to run all of them in
parallel.

### `rule_filter` (default, Phase 1)

Deterministic, no LLM. Two stages: hard filters that eliminate impossible
matches (availability, role-category, comp band, location), then a weighted
sum across seven 0–1 dimensions (role, sector, stage, skills, mission,
location, risk). Weights are role-category-specific — mentors only weigh
sector + mission, executives weigh all seven. Fast, explainable, free. See
[PLAN.md §4](PLAN.md).

### `agentic_filter` (Phase 2)

Claude Sonnet 4.6 with **11 in-process FastMCP tools** that filter and search
the candidate pool. The agent's job is to navigate the filter space — pick the
right tool for the focal entity (`find_investors` for a fundraising startup,
`find_operators` for a startup hiring leadership, `find_startups` for a talent
looking for a role) and broaden filters if the first cut returns too few
strong matches. **Score authority stays with `rule_filter`** so the demo's
`/compare` view stays meaningful; the agent only re-orders survivors and
writes the narrative `reasons` field (PLAN.md §7.5).

What you get over `rule_filter`:

- **Network-aware routing**: a startup with `seeking_investment=True` actually
  gets investor candidates surfaced via `find_investors`, not stuffed through
  the wrong rule_filter weights. Same for service providers, advisors, board.
- **Narrative reasons** that reference real fields — *"Fractional CFO comp
  $120K–$180K overlaps Marcus's $150K minimum, fundraising listed as required
  skill"* — instead of `rule_filter`'s templated *"Sector overlap:
  life_sciences"*.
- **Adaptive search** — if a strict filter returns fewer than `top_k` strong
  matches, the agent loosens one dimension and retries (capped at 4 tool calls
  per request).

Requires `ANTHROPIC_API_KEY` in `backend/.env`. Each request costs 1–4 API
calls (~16s end-to-end against the seeded corpus). If the key is missing,
`/match/...?matcher=agentic_filter` returns 503 and `/compare` falls back to
`rule_filter` only. Full design in [PLAN.md §7](PLAN.md).

The 11 tools: `find_operators`, `find_mentors`, `find_advisors`,
`find_board_members`, `find_investors`, `find_service_providers`,
`find_students_interns`, `find_startups`, `get_talent`, `get_startup`,
`count` — split by filter schema (one tool per match-flow), not one
polymorphic `find_talent` with conditional fields.

### `embedding` and `embedding_blended`

Two semantic matchers backed by `sentence-transformers/all-MiniLM-L6-v2` —
a 22M-parameter open-source model (Apache 2.0) that runs locally on CPU
or Apple Silicon GPU, no API calls, no rate limits.

**What gets embedded.** For each talent and startup we build one chunk of
text from the structured profile (headline, role, sectors, skills, mission,
bio for talent; one-liner, sector, required skills, mission, description
for startup) and splice in any long-form fields from `*_profile_extension`
when present (extended bio, highlights, resume-style detail, project
descriptions). The model produces a 384-dim unit-normalized vector;
similarity is plain cosine.

**Two score formulas, same hard filters.** Both run rule_filter
underneath for hard filters (availability, role, comp, location) and to
populate the dimension breakdown the match card already renders. They
diverge in how they compute the surfaced score:

| Matcher              | Score                                       |
|----------------------|---------------------------------------------|
| `embedding`          | clamped cosine similarity                   |
| `embedding_blended`  | `0.6 * cosine + 0.4 * rule_filter_score`    |

When cosine ≥ 0.55, both inject a leading `"Strong semantic alignment
(cosine 0.XX)"` reason; the rest are rule_filter's reasons unchanged.

**Why two?** They surface different things:

- **`rule_filter`** rewards explicit structured overlap — same sector
  enum, salary band fits, location compatible.
- **`embedding`** rewards *how people describe themselves and their work*.
  A Salt Lake fintech operator whose bio mentions "regulatory compliance,
  bank charters, and stablecoin treasury" can match a startup whose
  description talks about "money-movement infrastructure" even when the
  skill enums don't quite line up. Useful when the structured taxonomy
  hasn't caught up to how the field actually talks.
- **`embedding_blended`** is the practical default for ranking — the cosine
  signal lifts well-described matches but rule_filter still tilts the
  ordering toward candidates whose structured fields actually fit.

`/match/.../compare` runs all four matchers in parallel so judges can see
the spread on the same input.

**Caching.** Embedding the corpus is the slow step (~10s for ~500 profiles
on first run). Vectors are persisted to a `profile_embedding` table keyed
on `(entity_type, entity_id, model_name)` with a `source_signature` (sha256
of the constructed text). On read, the matcher hashes the freshly-built
text and reuses the stored vector if the signature matches; otherwise it
re-encodes and upserts. Edit a bio, the next match call notices and
re-encodes that one row — everything else stays cached. After the first
run, `/match/...?matcher=embedding*` returns in single-digit milliseconds.

The model loads lazily on the first match call (not at app boot) so
imports stay fast and tests don't pay the load cost. `model.encode(...)`
is sync + CPU-bound, so it runs in `asyncio.to_thread` to keep `/compare`
non-blocking. Implementation:
[backend/app/provider/matching/embedding.py](backend/app/provider/matching/embedding.py),
table:
[backend/app/model/database/profile_embedding.py](backend/app/model/database/profile_embedding.py).

---

## Discovery API — "find me X" directory lookups

`/match/*` answers *"who's the best startup for Marcus, with a full breakdown."*
`/discover/*` answers *"give me the investors / mentors / peer operators / etc.,
filtered."* Different jobs, different shapes.

Two perspectives × eight targets = **16 endpoints**:

```
POST /api/v1/discover/from/{talent|startup}/{focal_id}/{target}
```

where `target` ∈ `operators`, `mentors`, `advisors`, `board_members`,
`investors`, `service_providers`, `students_interns`, `startups`. Each takes
a typed filter body (or `{}` for "no filter, just give me the network") and
`?top_k=20`. Filter shapes mirror the agent's MCP tool signatures and live in
[backend/app/provider/matching/filters.py](backend/app/provider/matching/filters.py).

```bash
# Find investors interested in a fundraising life-sciences startup
curl -X POST http://127.0.0.1:8765/api/v1/discover/from/startup/$SID/investors?top_k=5 \
  -H 'content-type: application/json' \
  -d '{"sectors_focused_any":["life_sciences"], "stages_invested_any":["seed"], "utah_only":true}'

# Find mentors a talent could plug into
curl -X POST http://127.0.0.1:8765/api/v1/discover/from/talent/$TID/mentors?top_k=5 \
  -H 'content-type: application/json' \
  -d '{"sectors_of_interest":["life_sciences"]}'

# Find startups currently hiring (from a talent's perspective)
curl -X POST http://127.0.0.1:8765/api/v1/discover/from/talent/$TID/startups?top_k=5 \
  -H 'content-type: application/json' \
  -d '{"seeking":"hiring","stages":["seed","pre_seed"]}'

# Find peer operators (talent → talent)
curl -X POST http://127.0.0.1:8765/api/v1/discover/from/talent/$TID/operators?top_k=5 \
  -H 'content-type: application/json' \
  -d '{"sectors_of_interest":["life_sciences"]}'
```

Response shape ([backend/app/model/schema/discovery.py](backend/app/model/schema/discovery.py)):

```json
{
  "focal_type": "startup",
  "focal_id": "0e9274ea-…",
  "target_type": "investors",
  "matcher": "rule_filter",
  "results": [
    {"target": {…full talent…}, "score": 0.45, "top_reason": "Sector overlap: life_sciences"},
    …
  ],
  "total": 5
}
```

**Scoring**: when there's a (talent, startup) pair (talent→startup or
startup→talent), the score comes from the same `RuleFilterMatcher` singleton
`/match/*` uses — so a candidate's discovery score equals its match score.
For peer flows (talent→talent, startup→startup) the score is `0.0` and
results are alphabetical — the network filter has already narrowed; ranking
is out of scope until a peer-matcher exists.

**Vanilla only.** Discovery is rule_filter only by design — when the caller
supplies structured filters, the agent's filter-iteration value disappears.
For agentic narratives, hit `/match/*?matcher=agentic_filter`. See
[PLAN.md §7a](PLAN.md) for the design rationale.

The MCP server's filter wrappers and the discovery service share the same
filter primitives in
[backend/app/provider/matching/filters.py](backend/app/provider/matching/filters.py),
so rule semantics never drift between the two surfaces.

---

## Extended profile (deferred-load detail view)

Talent and startup rows on the matching path stay lean. Long-form content
(extended bio, resume URL, hero/cover images, links, projects, highlights)
lives in sibling `*_profile_extension` tables that the frontend loads on demand
from a separate endpoint:

```
GET  /api/v1/talent/{id}/profile     404 if no extension row, else extension fields
PUT  /api/v1/talent/{id}/profile     upsert the extension
GET  /api/v1/startup/{id}/profile
PUT  /api/v1/startup/{id}/profile
```

ORM models:
[backend/app/model/database/talent_profile_extension.py](backend/app/model/database/talent_profile_extension.py),
[backend/app/model/database/startup_profile_extension.py](backend/app/model/database/startup_profile_extension.py).

Match responses do **not** include these fields — keeps `/match` cheap and the
match-card payload predictable. Future agentic / embedding matchers can read
the extended text directly from the DB without changing the wire contract.

### Unified create — lean + extended + embedding in one POST

`POST /api/v1/talent` and `POST /api/v1/startup` accept the lean profile fields
*and* an optional `profile_extension` block in a single request. Both rows are
written in one transaction (no orphans on partial failure) and the
sentence-transformer vector is pre-computed in a FastAPI `BackgroundTasks` job
so the response returns fast while the next `/match` call hits a warm cache.

```bash
curl -X POST http://127.0.0.1:8765/api/v1/talent \
  -H 'content-type: application/json' \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "headline": "Fractional CFO — life sciences",
    "role_category": "executive",
    "role_titles_seeking": ["cfo"],
    "availability": "fractional",
    "comp_expectation_type": "salary_plus_equity",
    "location_city": "Salt Lake City",
    "primary_network": "operator",
    "profile_extension": {
      "bio_extended": "18 years in life sciences finance...",
      "image_url": "https://i.pravatar.cc/512?u=jane@example.com",
      "highlights": ["1x exit", "Took diagnostics co through Series B"],
      "projects": [{"title": "510(k) pre-sub generator", "description": "..."}]
    }
  }'
# → 201 with both the talent and the saved profile_extension inline.
#   Background task pre-computes the embedding (~50ms; first run loads the
#   model, ~1–3s). If the embedding fails, the matcher will lazy-compute on
#   first /match call — no user impact.
```

Response shape: [`TalentFullResponse`](backend/app/model/schema/talent.py) /
[`StartupFullResponse`](backend/app/model/schema/startup.py) — the existing
`TalentResponse` / `StartupResponse` plus a nullable `profile_extension`.
Atomic transaction lives in
[`TalentService.create_with_profile`](backend/app/service/talent_service.py)
/ [`StartupService.create_with_profile`](backend/app/service/startup_service.py);
embedding pre-warm helpers in
[backend/app/provider/matching/embedding.py](backend/app/provider/matching/embedding.py)
(`prewarm_talent_embedding` / `prewarm_startup_embedding`).

Backwards compatible: callers that omit `profile_extension` keep behaving like
the old endpoint — `profile_extension` comes back as `null`. The separate
`PUT /{id}/profile` route is still there for editing the extension after the
fact.

### Seed data fills it in

The seeder generates a `profile_extension` row for every talent (366) and
startup (132) on first boot — extended bio synthesized from the lean fields,
real working image URLs (`i.pravatar.cc`, `dicebear`, `picsum.photos` keyed on
slug/email), per-entity stable RNG so the same person renders the same
profile across reboots, and probabilistic optional fields (resume URL, github
links, cover images at 50–85% fill rates) so the data doesn't look uniform.
Independent pass: a DB seeded before this feature picks up extensions on the
next boot. See
[backend/app/seed/generator.py](backend/app/seed/generator.py)
(`build_talent_extension` / `build_startup_extension`) and
[backend/app/seed/utah_synthetic.py](backend/app/seed/utah_synthetic.py).

---

## Following + network score (PageRank)

Talent can follow other talent or startups. We run **PageRank** over the
follow graph and turn each person's score into a percentile bracket so they
get a one-glance answer to "how connected am I?"

### What's PageRank?

PageRank is the algorithm Larry Page and Sergey Brin invented at Stanford to
rank web pages — it's what made early Google work. The intuition is simple
and surprisingly applies to people just as well as web pages:

> **You are important if important people connect to you.**

The score is computed by repeatedly redistributing "rank mass" along the
edges of the graph. Concretely, each person's score is

```
PR(you) = (1 - d)/N  +  d · Σ over your followers f of  PR(f) / out_degree(f)
```

where `d = 0.85` (damping), `N` is the number of nodes, and `out_degree(f)` is
how many people follower `f` is following. A few useful consequences:

- **Your score depends on who follows you, not who you follow.** Following
  more people doesn't inflate your own score.
- **A follow from someone well-connected is worth more than a follow from
  someone obscure.** A nod from a respected mentor with a large network beats
  a nod from a brand-new account.
- **Following too many people dilutes the rank you pass on.** If you follow
  100 accounts, each one gets 1/100th of your influence.

We follow the formulation taught in BYU ACME's [PageRank lab][byu-pagerank]
including the standard dangling-node fix (rank from sinks gets redistributed
uniformly, so rank doesn't leak out of the system). Implementation in
[backend/app/service/pagerank_service.py](backend/app/service/pagerank_service.py).

[byu-pagerank]: https://labs.acme.byu.edu/Volume1/PageRank/PageRank.html

### Two graphs

Both are computed and cached separately. The cache key is `(talent_count,
startup_count, follow_edge_count)` — any mutation invalidates the cache and
the next request recomputes.

| Graph             | Nodes                                     | Edges                                          | Used for |
|-------------------|-------------------------------------------|------------------------------------------------|----------|
| `people_only`     | All talent rows (all 9 RoleCategories)    | talent → talent                                | Personal centrality among humans |
| `full_ecosystem`  | All talent **and** all startups           | talent → talent + talent → startup             | Same plus "ecosystem attention" — also produces a score for startups |

Including or excluding startup nodes doesn't change a person's relative rank
much (talent → startup edges are sinks under standard PageRank — startups
don't follow back), but exposing both lets us rank startups too in the
`full_ecosystem` graph.

### Brackets — "how connected are you?"

A raw score isn't useful by itself. We turn it into a **percentile within
the same role_category cohort** (mentors compared to mentors, students to
students, etc.) so a student in the top of their cohort gets credit even if
mentors as a group score higher in absolute terms. The percentile lands in
one of four buckets:

| Percentile | Bracket             | Reading                                                  |
|------------|---------------------|----------------------------------------------------------|
| 0–25       | **Limited network** | Most of the cohort has more inbound activity. Big upside if you start engaging. |
| 25–50      | Growing network     | You're building. A few well-placed follows from active mentors / investors will jump you a bracket. |
| 50–75      | Strong network      | Solidly connected — comparable to or better than half the cohort. |
| 75–100     | **Highly connected**| Top quartile of your cohort. People look to you. |

Startups get the same brackets, scored against all other startups in
the `full_ecosystem` graph.

### How it helps people improve

The bracket isn't a vanity badge — the response carries the raw score, the
rank within cohort, and the cohort size, so the frontend can show:

- **Where you stand** — "Strong network — ranked 12 of 60 mentors."
- **What moves the needle** — because PageRank weights by follower quality,
  the practical advice is consistent: get followed by people who are
  themselves well-followed (engaged mentors, active investors), and don't
  fan out your own follows so wide that your outgoing influence is diluted.
- **A direct comparison across graphs** — `people_only` vs `full_ecosystem`
  lets a person see whether their connectivity comes from people or from
  saving startups.

### Endpoints

```
POST   /api/v1/talent/{id}/follow/talent/{target_id}     204 (idempotent)
DELETE /api/v1/talent/{id}/follow/talent/{target_id}     204 (idempotent)
POST   /api/v1/talent/{id}/follow/startup/{startup_id}   204
DELETE /api/v1/talent/{id}/follow/startup/{startup_id}   204
GET    /api/v1/talent/{id}/following                     {talent: [...], startups: [...]}
GET    /api/v1/talent/{id}/followers                     [...] (talent followers)
GET    /api/v1/talent/{id}/network-score                 score + brackets for both graphs
GET    /api/v1/startup/{id}/followers                    talent who follow this startup
GET    /api/v1/startup/{id}/network-score                full_ecosystem score only
```

The seeder generates a deterministic starter graph (~3,000 talent → talent
edges + ~700 talent → startup edges) biased by role-pair affinity (students
follow mentors more than the reverse, executives follow investors, etc.) and
sector overlap. Same RNG seed every boot, so percentiles are stable across
restarts.

---

## "How can I connect?" — agentic outreach strategy

Looking at someone's profile and not sure how to reach out? `POST
/api/v1/connect/strategy` runs a Claude agent that drafts the answer.

```bash
curl -X POST http://127.0.0.1:8765/api/v1/connect/strategy \
  -H 'content-type: application/json' \
  -d '{"viewer_type":"talent","viewer_id":"<you>",
       "target_type":"talent","target_id":"<them>"}'
```

The response is a **deliberate split** between things the system can prove and
things the agent can suggest:

- **Server-computed structural facts** (never agent-supplied):
  `already_connected`, `target_follows_viewer`, `mutual_connections_count`
  + named bridge people, and PageRank brackets for both ends. Pulled from the
  same DAOs and `NetworkService` the standalone follow/network endpoints use,
  so it can never lie about whether you actually follow someone.
- **Agent-written prose**: 2–4 `fit_bullets` (why you're a fit), 3–5
  `approach_bullets` (channel, hook, do/don't), 3–5 `questions_to_ask`
  anchored on real fields from the target's profile (prior companies,
  projects, headline), plus a self-reported `confidence` ∈ [0, 1] and
  bucketed label (`low`/`medium`/`high`).

**What it accomplishes.** The matching surfaces (`/match`, `/discover`) tell
you *who* to reach out to. This endpoint tells you *how*. Instead of staring
at a profile, the user gets a ready-to-skim plan: are we already connected,
who do we both know, what's our shared vocabulary, what's the warm-intro path
through the follow graph, and what specific things should the first message
actually say. Confidence comes back honest — the agent will say "low" when
overlap is thin, so users learn to calibrate their outreach instead of
firing off identical templates.

The agent gets seven read-only MCP tools — `get_viewer_profile`,
`get_target_profile`, `get_overlap` (sectors / skills / missions / alma
maters / prior companies), `get_connection_status`, `get_warm_intros` (up
to 12 bridge people in the follow graph), `get_network_context` (PageRank
brackets), `get_match_score` (the same `rule_filter._score_pair` the matcher
uses) — all closed over the request's DAOFactory, no HTTP loopback.

Costs 1–6 Anthropic calls per request (typically 2 — one to fan out tools,
one to emit the JSON envelope). Returns 503 if `ANTHROPIC_API_KEY` is unset,
404 if either entity doesn't exist. Files:
[backend/app/api/connect.py](backend/app/api/connect.py),
[backend/app/service/connect_service.py](backend/app/service/connect_service.py),
[backend/app/mcp/connect_server.py](backend/app/mcp/connect_server.py),
[backend/app/model/schema/connect.py](backend/app/model/schema/connect.py).

---

## Onboarding: "Connect with LinkedIn or Google" → agent-built profile

A second Claude agent owns onboarding. Connect-with-LinkedIn gives us identity
+ email; everything else (experience, skills, sectors, comp expectations) the
user pastes from their resume / LinkedIn "About + Experience" section. Both
inputs are handed to Claude with a single MCP tool — `create_talent_profile` —
that writes the structured row through the same `TalentService.create()` the
public `POST /talent` route uses.

### Why a paste-box instead of pulling experience straight from LinkedIn

LinkedIn's only self-serve auth product is **Sign In with LinkedIn using
OpenID Connect**, which gives `openid profile email` scopes — i.e. `sub`
(LinkedIn ID), name, picture URL, email, locale. **That's it.** The richer
scopes (`r_basicprofile`, Member Data Portability, etc.) are gated behind
LinkedIn's Marketing Developer Platform partner review, take 1–4+ weeks to
process, and routinely get rejected for non-marketing/recruiting use cases.

So the practical move for a hackathon is OIDC for verified identity + a
resume / experience textbox the user pastes from. Claude parses the paste
and fills out the structured profile. We get richer data than `r_basicprofile`
would have given us, with zero app-review wait.

### Endpoint map

```
GET  /api/v1/auth/linkedin/login        302 to LinkedIn consent screen.
                                        Sets HMAC-signed state cookie.
GET  /api/v1/auth/linkedin/callback     LinkedIn redirects here. Backend
                                        verifies state, exchanges code for
                                        access token, fetches OIDC userinfo,
                                        stashes it under a one-shot token,
                                        302s the browser to the frontend
                                        with ?linkedin_handoff=<token>.
GET  /api/v1/auth/linkedin/handoff      Frontend pops the userinfo by token
                                        (single-use, 5-min TTL).
POST /api/v1/onboard/agent              Body: { linkedin_userinfo, resume_text? }
                                        Runs the Claude agent in-process,
                                        returns the saved Talent + the
                                        agent's optional acknowledgement.
```

LinkedIn access tokens are **not persisted** — we use them once to fetch
userinfo, then drop. The user-table linkage (linkedin_id, etc.) lands in a
follow-up PR.

### Agent flow

```
                          ┌──────────────────────────────────┐
[Frontend] ─POST /onboard/agent {userinfo, resume_text}─▶    │
                                                             │
                                                  OnboardService
                                                             │
                                ┌────────────────────────────┘
                                │
                                ▼
                build per-request FastMCP server
                with one tool: create_talent_profile(payload)
                                │
                                ▼
                Claude (Sonnet 4.6) tool-use loop
                ──────────────────────────────────
                system: enum vocabulary + extraction rules
                user:   LinkedIn userinfo + pasted resume text
                tools:  [create_talent_profile]
                                │
                  agent emits one tool_use call
                                │
                                ▼
              MCP tool runs in-process:
                1. TalentCreate.model_validate(payload)
                2. talent_dao.get_by_email(...)            ─▶ 409 conflict
                3. TalentService.create(payload)           ─▶ saved Talent
                                │
                                ▼
              status=created → service returns Talent → 200 OK
```

The MCP tool calls `TalentService.create()` **in-process** (not via HTTP
loopback), same pattern as the matching agent. No subprocess, no stdio. The
DAOFactory the tool uses is the same one FastAPI injected into the request,
so the transaction stays in one session.

If the agent ever returns a payload that fails Pydantic validation, the tool
returns `{status: "validation_error", errors: [...]}` and the agent retries
with the corrections. If the email is already taken, the tool returns
`{status: "conflict", talent_id: <existing>}` and the agent stops; the
endpoint surfaces a 409 with the existing talent_id (the schema-changes PR
will turn this into upsert behavior).

### Setting up LinkedIn OAuth

Walk through this once when you clone the repo.

1. Go to <https://www.linkedin.com/developers/apps> and click **Create app**.
   Pick a name (`Nucleus Institute`), associate it with a verified LinkedIn
   **Company Page** you admin (your personal profile won't work — create a
   free Page first if needed), upload any 100×100 logo, accept the API terms.
2. After creation, click **Verify** in the yellow banner on the app dashboard
   to associate the app with the Company Page.
3. **Products** tab → request access to **Sign In with LinkedIn using OpenID
   Connect**. This is self-serve and instant. Skip the others — they're gated.
4. **Auth** tab → **Authorized redirect URLs**: add
   `http://localhost:8765/api/v1/auth/linkedin/callback` (and a prod URL when
   you deploy). Must be byte-identical to `LINKEDIN_REDIRECT_URI`.
5. Copy **Client ID** and **Client Secret** from the same Auth tab.
6. Generate an HMAC secret for the state cookie:
   `python -c "import secrets; print(secrets.token_hex(32))"`
7. Fill these into `backend/.env`:
   ```
   LINKEDIN_CLIENT_ID="..."
   LINKEDIN_CLIENT_SECRET="..."
   LINKEDIN_REDIRECT_URI="http://localhost:8765/api/v1/auth/linkedin/callback"
   LINKEDIN_SCOPES="openid profile email"
   OAUTH_STATE_SECRET="<output of step 6>"
   FRONTEND_ONBOARD_URL="http://localhost:5173/onboard"
   ANTHROPIC_API_KEY="..."   # required for the onboarding agent
   ```

### Smoke-testing the flow

```bash
# 1. Start the OAuth dance in a browser:
open http://localhost:8765/api/v1/auth/linkedin/login
# Approve on LinkedIn → you'll land at FRONTEND_ONBOARD_URL?linkedin_handoff=<token>

# 2. Pop the userinfo (browser request, or curl with the same token):
curl 'http://localhost:8765/api/v1/auth/linkedin/handoff?token=<token>'
# → {"sub":"...", "name":"...", "email":"...", "picture":"...", ...}

# 3. Run the agent end-to-end (skip steps 1–2 if you just want to test the agent):
curl -X POST http://localhost:8765/api/v1/onboard/agent \
  -H 'content-type: application/json' \
  -d '{
    "linkedin_userinfo": {
      "sub":"abc123",
      "name":"Jane Doe",
      "email":"jane@example.com",
      "email_verified":true,
      "picture":"https://media.licdn.com/..."
    },
    "resume_text": "10 years backend engineering at Stripe and Square. Currently advising 3 Utah fintech startups. Open to fractional CTO roles. Salt Lake City, remote OK."
  }'
# → {"talent_id":"<uuid>", "talent": {...full Talent...}, "agent_notes": "Saved Jane's profile..."}

# 4. Confirm the row exists:
curl http://localhost:8765/api/v1/talent/<talent_id>
```

### Google sign-on (parallel flow)

Same OIDC pattern, mirrored under `/auth/google/*`:

```
GET  /api/v1/auth/google/login        302 to Google consent screen.
GET  /api/v1/auth/google/callback     302s to FRONTEND_ONBOARD_URL?google_handoff=<token>.
GET  /api/v1/auth/google/handoff      Pops the userinfo (single-use, 5-min TTL).
POST /api/v1/onboard/agent            Body now accepts EITHER linkedin_userinfo
                                      OR google_userinfo (exactly one), plus
                                      optional resume_text. Same agent.
```

Setup: create an OAuth 2.0 Client ID in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(APIs & Services → Credentials → Create Credentials → OAuth client ID → Web
application). Add `http://localhost:8765/api/v1/auth/google/callback` to
**Authorized redirect URIs**. Drop the values into `backend/.env`:

```
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:8765/api/v1/auth/google/callback"
GOOGLE_SCOPES="openid profile email"
```

`OAUTH_STATE_SECRET`, `FRONTEND_ONBOARD_URL`, and `ANTHROPIC_API_KEY` are
shared with the LinkedIn flow.

### What's deferred

- Persisting the OIDC access token, the verified provider-side ID
  (`linkedin_id` / `google_sub`), and upsert-by-provider-ID semantics —
  landing in a follow-up PR with the Talent table changes.
- Sessions / JWT / `/me` endpoint.
- Mirror flow for Startup founders (LinkedIn/Google → Startup profile).
- PDF resume upload (text paste only for now).
- Replacing the in-process handoff cache with Redis when we go multi-process.

---

## Outreach email — "Send email" button → Resend

`POST /api/v1/email/send` is the endpoint the frontend's "send email" button
hits. The frontend collects whatever fields it wants the user to fill out
(subject, message body, banner copy, optional CTA, signoff, etc.), and the
backend pours those values into a server-side Jinja template that renders to
HTML and dispatches via [Resend](https://resend.com/).

### Why a server-side template

The template lives at
[backend/app/templates/email/outreach.html.j2](backend/app/templates/email/outreach.html.j2)
so every send looks consistent — gradient banner, "From: …" pill, body
block, optional CTA button, Nucleus footer. The frontend never touches HTML;
it just types in fields. Auto-escape is on, so user-supplied text can't
smuggle markup into the email.

### Request

```bash
curl -X POST http://localhost:8765/api/v1/email/send \
  -H 'content-type: application/json' \
  -d '{
    "sender_type": "talent",
    "sender_id": "<sender uuid>",
    "recipient_type": "startup",
    "recipient_id": "<recipient uuid>",
    "subject": "Quick intro re: your geothermal stack",
    "variables": {
      "banner_eyebrow": "Nucleus Institute",
      "banner_title": "Jane Doe wants to chat",
      "banner_subtitle": "Fractional CFO — life sciences & energy",
      "from_label": "Jane Doe",
      "from_role": "Fractional CFO",
      "greeting": "Hi team,",
      "body": "Saw your seed-stage geothermal play and your CFO gap...",
      "cta_url": "https://nucleus.example.com/profiles/jane",
      "cta_label": "View my profile",
      "signoff": "— Jane",
      "footer_note": "Reply to chat directly."
    }
  }'
# → 200 {"sent": true, "resend_id": "re_…", "to": "founders@…"}
```

`sender_type` and `recipient_type` are each `"talent"` or `"startup"`.
The recipient's `email` column is the actual TO address — talents always have
one, startups optionally do. If the chosen recipient has no email, the
endpoint 400s. Reply-to defaults to the sender's email, so replies go back to
the human, not the platform; override with a top-level `reply_to` if you
want.

Everything in `variables` is forwarded to the template as-is — the keys
above (`banner_eyebrow`, `body`, `cta_url`, `signoff`, …) are what the
template reads, and any of them can be omitted to render an empty section.
Add new keys whenever you extend the template; no schema change needed.

### Setup

```
RESEND_API_KEY="re_..."
EMAIL_FROM_ADDRESS="Nucleus Institute <onboarding@resend.dev>"
```

`onboarding@resend.dev` works for dev without domain verification; switch to
a verified domain for prod. If `RESEND_API_KEY` is missing, the endpoint
returns 503 — the rest of the app still boots.

Implementation:
[backend/app/api/email.py](backend/app/api/email.py),
[backend/app/service/email_service.py](backend/app/service/email_service.py),
[backend/app/model/schema/email.py](backend/app/model/schema/email.py).

---

## What the demo does **not** do

- No auth, no sessions, no real users — `My Profile` simulates a current user
  by picking the second seeded talent.
- No edit / delete on talent or startup core records — only list, get, create
  (extended profile rows do support `PUT`).
- No investor / service-provider sub-profile inputs in the Join wizard yet.
