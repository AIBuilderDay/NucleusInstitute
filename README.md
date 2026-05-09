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

## What the demo does **not** do

- No auth, no sessions, no users.
- No edit / delete — only list, get, create.
- No investor / service-provider sub-profile inputs in the create form.
- No real styling system — handwritten CSS, will not survive contact with
  designers.

When you build the real frontend, throw `frontend/` away.
