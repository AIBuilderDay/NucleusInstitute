import { useState } from "react";
import type {
  Availability,
  CompExpectation,
  Network,
  Person,
  RiskTolerance,
  RoleCategory,
  Sector,
} from "../types";
import {
  AVAILABILITIES,
  AVAILABILITY_LABEL,
  COMP_EXPECTATIONS,
  COMP_EXPECTATION_LABEL,
  NETWORK_LABEL,
  NETWORKS,
  ROLE_CATEGORIES,
  ROLE_CATEGORY_LABEL,
  SECTORS,
  SECTOR_LABEL,
} from "../labels";
import { api } from "../api";
import { Field, selectStyle } from "../components/ui";

interface OnboardPageProps {
  onComplete: (profile: Person) => void;
}

interface Draft {
  name: string;
  email: string;
  headline: string;
  role_category: RoleCategory;
  availability: Availability;
  primary_network: Network;
  sectors_of_interest: Sector[];
  skills: string[];
  mission_keywords: string[];
  location_city: string;
  comp_expectation_type: CompExpectation;
  comp_min_salary_usd: number;
  risk_tolerance: RiskTolerance;
  bio: string;
}

const DEFAULT_DRAFT: Draft = {
  name: "",
  email: "",
  headline: "",
  role_category: "executive",
  availability: "full_time",
  primary_network: "operator",
  sectors_of_interest: [],
  skills: [],
  mission_keywords: [],
  location_city: "Salt Lake City",
  comp_expectation_type: "salary_plus_equity",
  comp_min_salary_usd: 150000,
  risk_tolerance: "medium",
  bio: "",
};

export function OnboardPage({ onComplete }: OnboardPageProps) {
  const [step, setStep] = useState(0);
  const [linkedin, setLinkedin] = useState("");
  const [scraping, setScraping] = useState(false);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fakeScrape = () => {
    // Real scrape would hit the backend; for now we just unlock the form.
    setScraping(true);
    setTimeout(() => {
      setScraping(false);
      setStep(1);
    }, 900);
  };

  const finish = async () => {
    setSubmitError(null);
    if (!draft.email.trim()) {
      setSubmitError("Email is required.");
      return;
    }
    if (!draft.name.trim()) {
      setSubmitError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createPerson({
        name: draft.name,
        email: draft.email,
        headline: draft.headline,
        role_category: draft.role_category,
        availability: draft.availability,
        years_experience: 0,
        sectors_of_interest: draft.sectors_of_interest,
        stage_preference: ["seed", "series_a"],
        role_titles_seeking: ["other"],
        skills: draft.skills,
        comp_expectation_type: draft.comp_expectation_type,
        comp_min_salary_usd: draft.comp_min_salary_usd,
        location_city: draft.location_city,
        remote_ok: true,
        primary_network: draft.primary_network,
        mission_keywords: draft.mission_keywords,
        risk_tolerance: draft.risk_tolerance,
        bio: draft.bio,
        trust_badges: ["Self-verified"],
      });
      onComplete(created);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 32px 64px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "var(--copper)" : "var(--whisper-200)",
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="card" style={{ padding: 32 }}>
            <h2
              className="display"
              style={{ fontSize: 24, color: "var(--nucleus-blue)", margin: "0 0 4px" }}
            >
              Pull from LinkedIn
            </h2>
            <p style={{ color: "var(--slate)", margin: "0 0 18px", fontSize: 13.5 }}>
              We'll fetch your headline, sectors, and skills. You stay in control of what's
              visible.
            </p>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: 13,
                  color: "var(--slate-light)",
                  fontSize: 13,
                }}
              >
                linkedin.com/in/
              </span>
              <input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="your-handle"
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 132px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  fontSize: 14,
                  background: "var(--white)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={fakeScrape} disabled={scraping}>
                {scraping ? "Reading your profile…" : "Pre-fill from LinkedIn"}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={scraping}>
                Skip — fill manually
              </button>
            </div>
            {scraping && <ScrapeProgress />}

            <div
              style={{
                marginTop: 32,
                padding: "16px 18px",
                background: "var(--wasatch-whisper)",
                borderRadius: 8,
                fontSize: 12.5,
                color: "var(--charcoal)",
                lineHeight: 1.6,
              }}
            >
              <strong>What we extract:</strong> headline, current title, prior companies,
              education, public skills, location. <strong>What we don't:</strong> private posts,
              connections, anything behind a login.
            </div>
          </div>
        )}

        {step === 1 && (
          <ConfirmProfileStep
            draft={draft}
            setDraft={setDraft}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <PreferencesStep
            draft={draft}
            setDraft={setDraft}
            onBack={() => setStep(1)}
            onFinish={finish}
            submitting={submitting}
            error={submitError}
          />
        )}
      </div>
    </div>
  );
}

function ScrapeProgress() {
  const stages = [
    "Resolving handle…",
    "Reading public sections…",
    "Mapping skills to Nucleus taxonomy…",
    "Drafting profile.",
  ];
  return (
    <div
      style={{
        marginTop: 18,
        padding: "14px 16px",
        background: "var(--whisper-50)",
        borderRadius: 8,
        border: "1px solid var(--color-border-soft)",
      }}
    >
      {stages.map((s, i) => (
        <div
          key={i}
          className="fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12.5,
            color: "var(--slate)",
            padding: "4px 0",
            animationDelay: `${i * 0.28}s`,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--copper)" }} />
          <span className="mono">{s}</span>
        </div>
      ))}
    </div>
  );
}

interface ConfirmStepProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onBack: () => void;
  onNext: () => void;
}

function ConfirmProfileStep({ draft, setDraft, onBack, onNext }: ConfirmStepProps) {
  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const togSector = (v: Sector) => {
    const arr = draft.sectors_of_interest;
    setDraft({
      ...draft,
      sectors_of_interest: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
    });
  };

  return (
    <div className="card" style={{ padding: 28 }}>
      <h2
        className="display"
        style={{ fontSize: 24, color: "var(--nucleus-blue)", margin: "0 0 4px" }}
      >
        Your draft profile
      </h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13.5 }}>
        Review what we extracted. Edit anything inline.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Name">
          <input
            style={selectStyle}
            value={draft.name}
            onChange={(e) => upd("name", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            style={selectStyle}
            value={draft.email}
            onChange={(e) => upd("email", e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            style={selectStyle}
            value={draft.location_city}
            onChange={(e) => upd("location_city", e.target.value)}
          />
        </Field>
        <Field label="Headline">
          <input
            style={selectStyle}
            value={draft.headline}
            onChange={(e) => upd("headline", e.target.value)}
          />
        </Field>
        <Field label="Primary network" hint="Self-declared bucket; matches the Nucleus form.">
          <select
            style={selectStyle}
            value={draft.primary_network}
            onChange={(e) => upd("primary_network", e.target.value as Network)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {NETWORK_LABEL[n]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role category" hint="Drives which match weights apply.">
          <select
            style={selectStyle}
            value={draft.role_category}
            onChange={(e) => upd("role_category", e.target.value as RoleCategory)}
          >
            {ROLE_CATEGORIES.map((r) => (
              <option key={r} value={r}>
                {ROLE_CATEGORY_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Availability">
          <select
            style={selectStyle}
            value={draft.availability}
            onChange={(e) => upd("availability", e.target.value as Availability)}
          >
            {AVAILABILITIES.map((r) => (
              <option key={r} value={r}>
                {AVAILABILITY_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Sectors of interest" hint="Pick all that apply.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SECTORS.map((s) => {
            const on = draft.sectors_of_interest.includes(s);
            return (
              <button
                key={s}
                onClick={() => togSector(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
                  background: on ? "var(--nucleus-blue)" : "var(--white)",
                  color: on ? "var(--wasatch-whisper)" : "var(--charcoal)",
                }}
              >
                {SECTOR_LABEL[s]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Skills (comma-separated)">
        <input
          style={selectStyle}
          value={draft.skills.join(", ")}
          onChange={(e) =>
            upd(
              "skills",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </Field>

      <Field label="Bio">
        <textarea
          rows={4}
          style={{ ...selectStyle, fontFamily: "inherit", resize: "vertical" }}
          value={draft.bio}
          onChange={(e) => upd("bio", e.target.value)}
        />
      </Field>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

interface PrefStepProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onBack: () => void;
  onFinish: () => void;
  submitting: boolean;
  error: string | null;
}

function PreferencesStep({ draft, setDraft, onBack, onFinish, submitting, error }: PrefStepProps) {
  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="card" style={{ padding: 28 }}>
      <h2
        className="display"
        style={{ fontSize: 24, color: "var(--nucleus-blue)", margin: "0 0 4px" }}
      >
        What you're looking for
      </h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13.5 }}>
        These power your match scores. Hard filters first, soft signals second.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Compensation expectation">
          <select
            style={selectStyle}
            value={draft.comp_expectation_type}
            onChange={(e) => upd("comp_expectation_type", e.target.value as CompExpectation)}
          >
            {COMP_EXPECTATIONS.map((r) => (
              <option key={r} value={r}>
                {COMP_EXPECTATION_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Minimum salary (USD)">
          <input
            type="number"
            style={selectStyle}
            value={draft.comp_min_salary_usd}
            onChange={(e) => upd("comp_min_salary_usd", parseInt(e.target.value, 10) || 0)}
          />
        </Field>
        <Field label="Risk tolerance">
          <select
            style={selectStyle}
            value={draft.risk_tolerance}
            onChange={(e) => upd("risk_tolerance", e.target.value as RiskTolerance)}
          >
            {(["low", "medium", "high"] as const).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mission keywords (comma-separated)">
          <input
            style={selectStyle}
            value={draft.mission_keywords.join(", ")}
            onChange={(e) =>
              upd(
                "mission_keywords",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "#fbe8e0",
            borderRadius: 8,
            color: "#8a3a3a",
            fontSize: 13,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={onBack} disabled={submitting}>
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-copper" onClick={onFinish} disabled={submitting}>
          {submitting ? "Publishing…" : "Publish & view matches →"}
        </button>
      </div>
    </div>
  );
}
