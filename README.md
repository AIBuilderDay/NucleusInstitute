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

**The `frontend/` directory is not a real product.** It's a single static
`index.html` with vanilla JS — no build step, no framework, no package.json.

Its only purpose is to give a **rough demonstration of what the backend can
do**: list the seeded Utah talent and startups, create new ones, and run the
matcher to see explainable match cards. Treat it as a developer poker for the
API, not a finished UX. It is meant to be **scrapped and replaced** with a
proper frontend project once the backend contract is solid.

If a field, label, or layout in the demo looks weird, it's almost certainly
because the field exists on the backend schema and was wired up directly
without UX polish. The names and shapes come from
[backend/app/model/schema/](backend/app/model/schema/) and
[backend/app/model/schema/enums.py](backend/app/model/schema/enums.py).

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
python3 -m http.server 3000
```

Open <http://localhost:3000>. The header shows a green pill when the API is
reachable; the API base URL is editable in the same header.

> **Why port 3000?** The backend's CORS allowlist
> ([backend/app/core/config.py](backend/app/core/config.py)) trusts
> `http://localhost:3000` and `http://localhost:5173`. Serve the static page
> from one of those origins. Opening `index.html` via `file://` will be blocked
> by CORS.

---

## What the demo can do

| Tab          | Hits                                                        | Use it for                                                  |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| **Browse**   | `GET /api/v1/talent`, `GET /api/v1/startup`                 | See the seeded data; click a card for the detail view.      |
| **Match**    | `POST /api/v1/match/{talent\|startup}/{id}` and `/compare`  | Pick "I am…", optionally filter by "Looking for…", see scored matches. |
| **+ Person** | `POST /api/v1/talent`                                       | Form-driven create. Covers the common fields, not investor / service-provider sub-profiles. |
| **+ Startup**| `POST /api/v1/startup`                                      | Same idea for startups.                                     |

The match cards render the score, per-dimension breakdown, "why it matches"
reasons, and any blockers (red-tinted when hard filters fail). Compare mode
shows side-by-side results from every registered matcher — the matchers are
pluggable, see [PLAN.md §2a](PLAN.md).

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
   `http://localhost:8000/api/v1/auth/linkedin/callback` (and a prod URL when
   you deploy). Must be byte-identical to `LINKEDIN_REDIRECT_URI`.
5. Copy **Client ID** and **Client Secret** from the same Auth tab.
6. Generate an HMAC secret for the state cookie:
   `python -c "import secrets; print(secrets.token_hex(32))"`
7. Fill these into `backend/.env`:
   ```
   LINKEDIN_CLIENT_ID="..."
   LINKEDIN_CLIENT_SECRET="..."
   LINKEDIN_REDIRECT_URI="http://localhost:8000/api/v1/auth/linkedin/callback"
   LINKEDIN_SCOPES="openid profile email"
   OAUTH_STATE_SECRET="<output of step 6>"
   FRONTEND_ONBOARD_URL="http://localhost:5173/onboard"
   ANTHROPIC_API_KEY="..."   # required for the onboarding agent
   ```

### Smoke-testing the flow

```bash
# 1. Start the OAuth dance in a browser:
open http://localhost:8000/api/v1/auth/linkedin/login
# Approve on LinkedIn → you'll land at FRONTEND_ONBOARD_URL?linkedin_handoff=<token>

# 2. Pop the userinfo (browser request, or curl with the same token):
curl 'http://localhost:8000/api/v1/auth/linkedin/handoff?token=<token>'
# → {"sub":"...", "name":"...", "email":"...", "picture":"...", ...}

# 3. Run the agent end-to-end (skip steps 1–2 if you just want to test the agent):
curl -X POST http://localhost:8000/api/v1/onboard/agent \
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
curl http://localhost:8000/api/v1/talent/<talent_id>
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

- No auth, no sessions, no users.
- No edit / delete — only list, get, create.
- No investor / service-provider sub-profile inputs in the create form.
- No real styling system — handwritten CSS, will not survive contact with
  designers.

When you build the real frontend, throw `frontend/` away.
