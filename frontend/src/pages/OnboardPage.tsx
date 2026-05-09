import { useState } from "react";
import type {
  Availability,
  CompExpectation,
  GoogleUserInfo,
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
import { Field, selectClass } from "../components/ui";

interface OnboardPageProps {
  onComplete: (profile: Person) => void;
  googleUserinfo?: GoogleUserInfo | null;
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

export function OnboardPage({ onComplete, googleUserinfo }: OnboardPageProps) {
  const startStep = googleUserinfo ? -1 : 0;
  const [step, setStep] = useState(startStep);
  const [draft, setDraft] = useState<Draft>(() => {
    if (!googleUserinfo) return DEFAULT_DRAFT;
    return {
      ...DEFAULT_DRAFT,
      name: googleUserinfo.name ?? "",
      email: googleUserinfo.email ?? "",
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const totalSteps = googleUserinfo ? 3 : 2;
  const stepIndexForBar = googleUserinfo ? step + 1 : step;

  return (
    <div>
      <div className="max-w-[880px] mx-auto pt-32 px-32 pb-64">
        <div className="flex gap-6 mb-24">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-4 rounded-[2px] ${i <= stepIndexForBar ? "bg-gold" : "bg-pearl-200"}`}
            />
          ))}
        </div>

        {step === -1 && googleUserinfo && (
          <ResumeAgentStep
            googleUserinfo={googleUserinfo}
            onAgentResult={(person) => {
              setDraft((prev: Draft) => ({
                ...prev,
                name: person.name ?? prev.name,
                email: person.email ?? prev.email,
                headline: person.headline ?? prev.headline,
                role_category: person.role_category ?? prev.role_category,
                availability: person.availability ?? prev.availability,
                primary_network: person.primary_network ?? prev.primary_network,
                sectors_of_interest:
                  person.sectors_of_interest ?? prev.sectors_of_interest,
                skills: person.skills ?? prev.skills,
                mission_keywords: person.mission_keywords ?? prev.mission_keywords,
                location_city: person.location_city ?? prev.location_city,
                comp_expectation_type:
                  person.comp_expectation_type ?? prev.comp_expectation_type,
                comp_min_salary_usd:
                  person.comp_min_salary_usd ?? prev.comp_min_salary_usd,
                risk_tolerance: person.risk_tolerance ?? prev.risk_tolerance,
                bio: person.bio ?? prev.bio,
              }));
              setStep(0);
            }}
            onSkip={() => setStep(0)}
          />
        )}

        {step === 0 && (
          <ConfirmProfileStep
            draft={draft}
            setDraft={setDraft}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <PreferencesStep
            draft={draft}
            setDraft={setDraft}
            onBack={() => setStep(0)}
            onFinish={finish}
            submitting={submitting}
            error={submitError}
          />
        )}
      </div>
    </div>
  );
}

interface ResumeAgentStepProps {
  googleUserinfo: GoogleUserInfo;
  onAgentResult: (person: Person) => void;
  onSkip: () => void;
}

function ResumeAgentStep({ googleUserinfo, onAgentResult, onSkip }: ResumeAgentStepProps) {
  const [resumeText, setResumeText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.onboardAgent({
        google_userinfo: googleUserinfo,
        resume_text: resumeText.trim() || undefined,
      });
      onAgentResult(res.talent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card p-28">
      <div className="flex items-center gap-12 mb-18">
        {googleUserinfo.picture && (
          <img
            src={googleUserinfo.picture}
            alt=""
            className="w-40 h-40 rounded-full"
          />
        )}
        <div>
          <h2 className="font-display text-[24px] text-nucleus-blue mb-2">
            Welcome{googleUserinfo.given_name ? `, ${googleUserinfo.given_name}` : ""}.
          </h2>
          <p className="text-graphite-muted text-[13px] m-0">
            Signed in as {googleUserinfo.email ?? googleUserinfo.name ?? "Google user"}.
          </p>
        </div>
      </div>

      <p className="text-graphite text-[14px] mb-14">
        Paste your resume (or LinkedIn export, or any bio prose) below. The Nucleus
        agent will extract your role, sectors, skills, and preferences — you can
        edit anything on the next screen.
      </p>

      <Field label="Resume / bio (paste here)">
        <textarea
          rows={14}
          className={`${selectClass} font-[inherit] resize-y`}
          placeholder="Paste resume text, LinkedIn About section, or any prose describing your experience…"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          disabled={running}
        />
      </Field>

      {error && (
        <div className="mt-14 py-10 px-14 bg-[#fbe8e0] rounded-[8px] text-[#8a3a3a] text-[13px]">
          ⚠ {error}
        </div>
      )}

      <div className="flex gap-10 mt-18 items-center">
        <button
          className="btn btn-ghost"
          onClick={onSkip}
          disabled={running}
        >
          Skip — fill manually
        </button>
        <div className="flex-1" />
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={running}
        >
          {running ? "Building profile…" : "Build my profile →"}
        </button>
      </div>
    </div>
  );
}

interface ConfirmStepProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onNext: () => void;
}

function ConfirmProfileStep({ draft, setDraft, onNext }: ConfirmStepProps) {
  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const togSector = (v: Sector) => {
    const arr = draft.sectors_of_interest;
    setDraft({
      ...draft,
      sectors_of_interest: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
    });
  };

  return (
    <div className="card p-28">
      <h2 className="font-display text-[24px] text-nucleus-blue mb-4">
        Your draft profile
      </h2>
      <p className="text-graphite-muted mb-22 text-[13.5px]">
        Review what we extracted. Edit anything inline.
      </p>
      <div className="grid grid-cols-2 gap-14">
        <Field label="Name">
          <input
            className={selectClass}
            value={draft.name}
            onChange={(e) => upd("name", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={selectClass}
            value={draft.email}
            onChange={(e) => upd("email", e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            className={selectClass}
            value={draft.location_city}
            onChange={(e) => upd("location_city", e.target.value)}
          />
        </Field>
        <Field label="Headline">
          <input
            className={selectClass}
            value={draft.headline}
            onChange={(e) => upd("headline", e.target.value)}
          />
        </Field>
        <Field label="Primary network" hint="Self-declared bucket; matches the Nucleus form.">
          <select
            className={selectClass}
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
            className={selectClass}
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
            className={selectClass}
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
        <div className="flex flex-wrap gap-6">
          {SECTORS.map((s) => {
            const on = draft.sectors_of_interest.includes(s);
            return (
              <button
                key={s}
                onClick={() => togSector(s)}
                className={`py-6 px-12 rounded-full text-[12px] font-medium border ${
                  on
                    ? "border-nucleus-blue bg-nucleus-blue text-blue-50"
                    : "border-pearl-300 bg-white text-graphite"
                }`}
              >
                {SECTOR_LABEL[s]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Skills (comma-separated)">
        <input
          className={selectClass}
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
          className={`${selectClass} font-[inherit] resize-y`}
          value={draft.bio}
          onChange={(e) => upd("bio", e.target.value)}
        />
      </Field>

      <div className="flex gap-10 mt-8">
        <div className="flex-1" />
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
    <div className="card p-28">
      <h2 className="font-display text-[24px] text-nucleus-blue mb-4">
        What you're looking for
      </h2>
      <p className="text-graphite-muted mb-22 text-[13.5px]">
        These power your match scores. Hard filters first, soft signals second.
      </p>
      <div className="grid grid-cols-2 gap-14">
        <Field label="Compensation expectation">
          <select
            className={selectClass}
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
            className={selectClass}
            value={draft.comp_min_salary_usd}
            onChange={(e) => upd("comp_min_salary_usd", parseInt(e.target.value, 10) || 0)}
          />
        </Field>
        <Field label="Risk tolerance">
          <select
            className={selectClass}
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
            className={selectClass}
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
        <div className="mt-14 py-10 px-14 bg-[#fbe8e0] rounded-[8px] text-[#8a3a3a] text-[13px]">
          ⚠ {error}
        </div>
      )}

      <div className="flex gap-10 mt-18">
        <button className="btn btn-ghost" onClick={onBack} disabled={submitting}>
          ← Back
        </button>
        <div className="flex-1" />
        <button className="btn btn-copper" onClick={onFinish} disabled={submitting}>
          {submitting ? "Publishing…" : "Publish & view matches →"}
        </button>
      </div>
    </div>
  );
}
