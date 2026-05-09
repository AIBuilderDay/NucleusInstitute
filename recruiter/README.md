# Nucleus · Talent Hunter (recruiter app)

A second, completely separate frontend that talks to the same Nucleus
FastAPI backend. Built for the AI Builder Day "give yourself a promotion"
hackathon — the user-facing answer to *"we need to hire AI/software
engineers, but we don't have time to dig through LinkedIn."*

Lives at `recruiter/`, sibling to `frontend/`. Importing one does not touch
the other; the only backend change supporting this app is one extra CORS
origin (`http://localhost:5175`).

---

## What it does

1. **Find** — `POST /api/v1/discover/from/startup/{your-startup-id}/operators`
   (and `/students_interns`) with a typed filter body (sector, skills,
   comp ceiling, stages, location, remote). Results come back ranked by
   `rule_filter` score with a one-line `top_reason`.
2. **Visualize** — score-driven polar layout (closer orbit = stronger fit)
   so you can eyeball the candidate pool before reading any cards.
3. **Outreach** — bulk-pick candidates, draft personalized emails (subject
   + body auto-derived from each candidate's skills overlap with the
   startup's `required_skills`), edit per-recipient, send via
   `/api/v1/email/send` (Resend under the hood).
4. **Autopilot** — toggle a recurring subscription with
   `/api/v1/auto-match/subscribe?frequency_days=N`. APScheduler in the
   backend ticks every `AUTO_MATCH_TICK_MINUTES` and runs the digest, which
   re-runs discovery, drafts personalized email per candidate, sends, and
   logs already-contacted pairs so the next run skips them. "Run now"
   button forces an immediate tick for demos.

---

## Run it

From the repo root:

```bash
task dev              # backend on :8765 (terminal A)
task recruiter:dev    # this app on :5175 (terminal B)
```

Then visit <http://localhost:5175>. The header has a startup picker — you
post outreach as the startup you select. (For real production use, that
would be your own startup row; for the hackathon the synthetic seed
includes a dozen Utah startups to play with.)

If you want to point at a different backend, set
`localStorage["nucleus-recruiter.api"] = "https://your-host"` in the dev
console, or `VITE_API_BASE_URL` at build time.

---

## Required env (backend side)

For email to actually leave the building, the backend needs:

- `RESEND_API_KEY` — outreach send
- `EMAIL_FROM_ADDRESS` — verified Resend domain (no-reply@your-domain)

For autopilot's per-candidate drafting:

- `ANTHROPIC_API_KEY` — Sonnet 4.6 drafts each personalized body

Without these, the app still loads, search still works, and the composer
still drafts locally — but `Send` will return 503 and the autopilot tick
will skip with a "no provider configured" note in its report.

---

## What we deliberately did NOT build

- A second auth system. The recruiter app trusts the backend's existing
  auth posture (no JWT for hackathon; session-trusted via the LinkedIn
  OAuth flow that `frontend/` already uses).
- A custom matcher. We use `rule_filter` via the existing `/discover` API.
  The agentic and embedding matchers are reachable but slower; rule_filter
  is the right default for a directory-style flow.
- A separate database. One Nucleus DB, two frontends.
- Any change to `frontend/`. Anything in that folder is unchanged.
