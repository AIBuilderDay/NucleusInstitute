# TODO — third-party integration plans

Three external products to evaluate against Nucleus Institute. Ordered by
fit-confidence — Leland is the strongest, Cheers is the weakest.

---

## 1. Leland (joinleland.com) — Coaching tab on Nucleus

**What Leland is.** Online coaching marketplace: 650+ vetted coaches (McKinsey,
Bain, OpenAI, Spotify, Stanford, Columbia) across careers (PM, IB, SWE, AI
roles, exec coaching), education (MBA, law, med, college, test prep), and
skills (AI proficiency, leadership, founder coaching). They run 250+ free
livestreams a month and sell paid 1:1s. They also operate a **Partner
program** with three tracks: **Universities, AI Transformation, and
Outplacement**.

**Why it fits Nucleus.**
- Nucleus already has a Mentor Network (informal, free) and an SME Advisor
  Network (formal, paid in equity). Leland fits a **third tier**: paid 1:1
  coaching by hourly rate, with no equity ask. That's the slot for someone
  who needs prep for a specific event (board pitch, fundraising deck,
  technical interview, MBA app) and doesn't need a long-term advisor.
- Nucleus is already positioned around U of U / BYU / USU, which lines up
  with Leland's **Universities** partner track.

**Recommended scope (MVP — half-day of work).**
1. New tab in the main `frontend/` (NOT the recruiter app): **"Coaching"**.
2. Curated landing — for each `RoleCategory` and `Sector`, hand-pick a
   sub-page on joinleland.com (e.g.
   `/coaches/coaches/software-engineering`, `/coaches/coaches/mba-admissions`)
   and link out with a UTM tag (`utm_source=nucleus&utm_medium=coaching_tab`).
3. Add a "Suggested coach" CTA on a Talent's profile when their match scores
   show a **gap dimension** (e.g. low role-match → suggest exec coaching;
   low skill-match → suggest skills coaching). The PLAN.md gap-analyzer is
   already on the TO-DO list — this slots straight into it.

**Recommended scope (Partner — 1–2 weeks).**
1. Apply to the **Universities** track at <https://www.joinleland.com/partners>.
   Pitch: Nucleus is the operator/talent hub for Utah's three R1 universities;
   we'd integrate Leland coaching as a paid extension of our mentor network.
2. Negotiate revenue share or affiliate link. Track conversions via UTMs to
   prove ROI before any revenue split is finalized.
3. **AI Transformation** track is also a likely fit — Nucleus startups
   regularly ask "how do we put AI in our workflow." Worth asking about both.

**Open questions.**
- Does Leland publish coach availability via API, or is it iframe/link-out
  only? Their page doesn't advertise an API. Default plan: link-out + UTM.
- Does the Partner program pass back conversion data? If not, instrument
  client-side click events on our side.

**Files to add (when we build it):**
- `frontend/src/pages/CoachingPage.tsx` — landing + curated category cards
- `frontend/src/lib/leland.ts` — UTM-tagged URL builder; **no API key here,
  it's a public link rewriter**
- `frontend/src/routeHero.ts` — add `"coaching"` to the `Route` union and
  `HERO` map
- (later) `backend/app/service/coaching_suggest_service.py` — given a Talent
  + their MatchResult dimension scores, return one or two recommended
  Leland category URLs. Pure rules, no LLM.

---

## 2. Surge (surge.app) — SMS outreach to hot candidates

**What Surge is.** SMS API for developers. Carrier registration in ≤72h
(competitors take weeks), Node/Python/Ruby/Elixir SDKs, REST API, pricing
from $5/mo (hobby) to $250+/mo (custom). Supports MMS, link shortening, and
no-code message blasts.

**Why it fits Nucleus.**
- The recruiter app already wraps Resend for email outreach. **Reply rate on
  cold email is single digits; SMS reply rate runs ~30–40%** for warm intros.
  Surge gives us a second channel for the **top 10% of candidates** who say
  yes to SMS outreach — without rebuilding the carrier-registration stack
  ourselves (which would take 4–6 weeks via Twilio direct).
- The auto-match system is already abstracted: we could swap the email
  sender for a "best channel" picker and SMS becomes a one-line addition.

**Recommended scope (1 day of work).**
1. Add a `phone_e164: str | None` column to the Talent ORM (nullable; opt-in
   only — never inferred).
2. Onboarding flow lands a checkbox: *"OK to text me about high-fit roles?"*
   → sets a boolean `sms_opt_in: bool`.
3. New backend service `app/service/sms_service.py` mirroring `EmailService`
   (Resend → Surge swap; same `(sender, recipient, body)` shape). Templated
   bodies live in `app/templates/sms/` as plain text — no HTML.
4. `POST /api/v1/sms/send` route gated on `sms_opt_in == True`; returns 409
   for non-opted candidates (loud, not silent — caller should never have
   tried).
5. Recruiter app: when a candidate has `sms_opt_in=True`, show an "SMS"
   button alongside "Email" in the OutreachComposer with a 160-char preview.

**Cost model.** Hobby tier ($5/mo + per-message credits) is enough for the
demo. The team can upgrade when batch sends exceed credit headroom — Surge
docs publish per-message rates so we can math this against expected volume
before the first paid send.

**Compliance gate.** US SMS for marketing requires explicit opt-in. **Do
not** bulk-send to a list pulled from the Talent table without an opt-in
column. Surge's free tier doesn't waive this — it's a TCPA / 10DLC issue,
not a Surge issue. Easiest path: gate `sms_opt_in` on the onboarding form
*and* a re-confirm at the time the user joins their first auto-match
subscription.

**Files to add:**
- `backend/app/core/config.py` — add `surge_api_key: str | None = None`
- `backend/app/service/sms_service.py` — clone `EmailService` shape, swap
  Resend client for Surge
- `backend/app/templates/sms/outreach.txt.j2` — 160-char body
- `backend/app/api/sms.py` — `POST /sms/send`, gated on opt-in
- `recruiter/src/components/OutreachComposer.tsx` — add channel toggle when
  the candidate is SMS-eligible
- `backend/app/model/database/talent.py` — `phone_e164` + `sms_opt_in`

---

## 3. Cheers (cheers.tech) — Probably not for Nucleus

**What Cheers is.** "Get found by AI search." Scans your business across
50+ directories, review sites, and AI assistants (Perplexity, ChatGPT, etc.)
to identify visibility gaps; uses NFC badges + frontline staff prompts to
generate reviews. Targets **multi-location service operators**: HVAC,
plumbing, roofing, restaurants, hotels, retail.

**Why it probably doesn't fit Nucleus.**
- Nucleus is a **two-sided matchmaking platform**, not a service business
  asking customers for Google reviews. The Cheers value prop (review
  velocity for multi-location physical-presence businesses) doesn't map.
- The Nucleus *startups in the directory* could maybe use Cheers, but
  startup founders rarely have a "frontline staff" or NFC-badge moment —
  Cheers' core mechanic is wrong for them too.

**Where it might fit (low conviction).**
- *Discoverability of the Nucleus brand itself.* If a Utah founder asks
  ChatGPT "where do I find a CTO in Utah," does Nucleus surface? Cheers
  could measure that. But this is a one-time SEO/AI-SEO audit, not an
  integration — buy the audit, act on findings, done. Doesn't justify a
  product partnership.
- *Referral relationship.* If a Nucleus startup IS a multi-location service
  business (rare in the current Utah deep-tech focus, but possible), refer
  them to Cheers. Affiliate link only.

**Recommendation: skip integration work; revisit if Nucleus pivots toward
B2C / consumer-facing startups.** If you want the audit, book the demo
yourself — no engineering required.

---

## Decision matrix (for fast triage)

| Tool   | Effort     | Confidence  | Demo-on-Monday? |
|--------|------------|-------------|-----------------|
| Leland | half-day   | High        | Yes (link-out tab) |
| Surge  | 1 day      | Medium-high | Yes (1 candidate, 1 SMS) |
| Cheers | n/a        | Low         | No — would be a painted door |

---

## Out-of-scope (documented so we don't redo this discussion)

- **Building our own SMS provider.** Twilio direct + 10DLC = 4–6 weeks of
  carrier-registration nonsense before the first send. Surge exists to
  delete that.
- **Building our own coaching marketplace.** Two-sided supply problem;
  Leland already solved it. Don't compete on supply, integrate it.
- **Cheers full integration.** Listed for completeness; do not implement
  unless the product strategy changes.
