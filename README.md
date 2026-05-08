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

## What the demo does **not** do

- No auth, no sessions, no users.
- No edit / delete — only list, get, create.
- No investor / service-provider sub-profile inputs in the create form.
- No real styling system — handwritten CSS, will not survive contact with
  designers.

When you build the real frontend, throw `frontend/` away.
