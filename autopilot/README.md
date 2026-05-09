# HEAL Autopilot

A standalone FastAPI service that runs HEAL Engineering's hiring agent on a
schedule. Lives at `autopilot/`, separate from `backend/` and `frontend/` so
nothing here can break the existing Nucleus build.

## What it does

1. The user saves two free-text fields and a schedule via the recruiter UI:
   - **Candidate criteria** — what to look for
   - **Email instructions** — how to write outreach emails
   - **Schedule** — every N hours, on/off toggle
2. On schedule (or manual "Run now"), an agent loop fires:
   - Anthropic Sonnet 4.6 + a FastMCP server with 5 tools
   - Tools wrap the Nucleus backend over HTTP (`/discover`, `/email/send`)
     plus a local SQLite for contact dedup
   - Agent reads its brief, searches, drafts personalized emails, sends —
     fully autonomous
3. Run history is logged to `data/autopilot.db` and surfaced in the UI.

## Why a separate service

- Different concerns (sourcing + outreach automation vs. matching engine)
- Different uptime requirements (this can crash without taking the matching
  API down)
- Cleaner mental model for the hackathon — one service, one job
- Doesn't have to follow the existing backend's patterns

## Run it

```bash
# Once: copy and fill in the API key
cp autopilot/.env.example autopilot/.env
# edit autopilot/.env, set ANTHROPIC_API_KEY

# Start the matching backend (terminal A)
task dev

# Start the autopilot (terminal B)
task autopilot:dev
# → autopilot listens on http://127.0.0.1:8766

# Start the recruiter UI (terminal C)
task recruiter:dev
# → http://localhost:5175
```

## Endpoints

| Method | Path        | Purpose |
|--------|-------------|---------|
| GET    | `/health`   | Liveness + whether ANTHROPIC_API_KEY is configured |
| GET    | `/config`   | Load saved instructions + schedule |
| PUT    | `/config`   | Save instructions + schedule |
| GET    | `/runs`     | Recent agent runs (history) |
| POST   | `/run-now`  | Fire the agent immediately |
| GET    | `/heal`     | Resolve HEAL Engineering's startup id (auto-creates if missing) |
| GET    | `/contacts` | List talent_ids we've already emailed |

## Agent's MCP toolkit

| Tool                       | What it does |
|----------------------------|--------------|
| `find_candidates`          | Searches Nucleus by sector / skills / comp / location / stages, returns ranked list with `already_contacted` flag |
| `get_candidate(id)`        | Pulls a full Nucleus profile |
| `send_outreach_email(...)` | Sends via the Nucleus email service (Resend), logs to dedup table |
| `already_contacted(id)`    | Single-talent dedup check |
| `list_recently_contacted`  | Pre-flight skip list |

The agent has a hard cap of **5 emails per run** (server-side; tool refuses
beyond that). Iteration cap of **12 tool turns**.

## Required env

- `ANTHROPIC_API_KEY` — without this `/run-now` and the scheduled tick both
  return a clear error in the run log; nothing crashes.
- `NUCLEUS_BACKEND_URL` — defaults to `http://127.0.0.1:8765` (`task dev`).
- `RESEND_API_KEY` lives on the **Nucleus backend**, not here. The autopilot
  doesn't talk to Resend directly — it calls the Nucleus `/email/send` route.
