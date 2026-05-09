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

---

## Onboarding: "Connect with LinkedIn" → agent-built profile

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

### What's deferred

- Persisting the LinkedIn access token, the verified `linkedin_id`, and
  upsert-by-`linkedin_id` semantics — landing in a follow-up PR with the
  Talent table changes.
- Sessions / JWT / `/me` endpoint.
- Mirror flow for Startup founders (LinkedIn → Startup profile).
- PDF resume upload (text paste only for now).
- Replacing the in-process handoff cache with Redis when we go multi-process.

---

## What the demo does **not** do

- No auth, no sessions, no real users — `My Profile` simulates a current user
  by picking the second seeded talent.
- No edit / delete on talent or startup core records — only list, get, create
  (extended profile rows do support `PUT`).
- No investor / service-provider sub-profile inputs in the Join wizard yet.
