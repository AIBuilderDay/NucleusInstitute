import { useEffect, useMemo, useState } from "react";
import type { InferredInterests, LinkedInUserinfo } from "../inferenceApi";
import { extractKeywords, inferInterests } from "../inferenceApi";
import type { UserMatch } from "../EcosystemContext";
import { ParticleNetwork } from "./ParticleNetwork";

interface InterestModalProps {
  userinfo: LinkedInUserinfo | null;
  /** If provided, skip the reading phase and open in confirm pre-filled. */
  editingMatch?: UserMatch | null;
  onCancel: () => void;
  onConfirm: (m: UserMatch) => void;
}

// Curated short lists — keep the popup scannable, not overwhelming.
const SECTOR_OPTIONS = [
  "B2B Software",
  "FinTech",
  "Life Sciences",
  "AI / ML",
  "Security",
  "Hardware",
  "Consumer",
  "Energy",
];

const STAGE_OPTIONS: Array<[string, string]> = [
  ["pre_seed", "Pre-seed"],
  ["seed", "Seed"],
  ["series_a", "Series A"],
  ["growth", "Growth"],
];

const LOOKING_FOR_OPTIONS: Array<[string, string]> = [
  ["resources", "State resources"],
  ["startups", "Browse startups"],
  ["both", "Both"],
];

const UTAH_CITIES = [
  "Salt Lake City",
  "Provo",
  "Lehi",
  "Ogden",
  "Park City",
  "Logan",
  "St. George",
  "Sandy",
  "South Jordan",
  "American Fork",
  "Heber City",
  "Draper",
];

export function InterestModal({
  userinfo,
  editingMatch,
  onCancel,
  onConfirm,
}: InterestModalProps) {
  const isEditing = !!editingMatch;
  const [phase, setPhase] = useState<"reading" | "confirm">(
    isEditing ? "confirm" : "reading",
  );
  const [inferred, setInferred] = useState<InferredInterests | null>(
    isEditing
      ? {
          city: editingMatch!.city,
          sectors: editingMatch!.sectors,
          stages: editingMatch!.stages,
          lookingFor: editingMatch!.lookingFor,
          evidence: editingMatch!.evidence,
          confidence: "high",
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  // editable state for the confirm phase
  const [city, setCity] = useState(editingMatch?.city ?? "");
  const [sectors, setSectors] = useState<string[]>(editingMatch?.sectors ?? []);
  const [stages, setStages] = useState<string[]>(editingMatch?.stages ?? []);
  const [lookingFor, setLookingFor] = useState<UserMatch["lookingFor"]>(
    editingMatch?.lookingFor ?? ["both"],
  );
  const [distanceMaxMiles, setDistanceMaxMiles] = useState<number | null>(
    editingMatch?.distanceMaxMiles ?? null,
  );
  const [refineNote, setRefineNote] = useState("");
  const [keywords, setKeywords] = useState<string[]>(editingMatch?.keywords ?? []);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordError, setKeywordError] = useState<string | null>(null);

  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (isEditing) return; // skip inference in edit mode — we already have the data
    if (!userinfo) return;
    let dead = false;
    void (async () => {
      try {
        const r = await inferInterests(userinfo);
        if (dead) return;
        // hold the animation on screen for at least 2.4s so it feels intentional
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, 2400 - elapsed);
        await new Promise((res) => setTimeout(res, wait));
        if (dead) return;
        setInferred(r);
        setCity(r.city);
        setSectors(r.sectors);
        setStages(r.stages);
        setLookingFor(r.lookingFor);
        setPhase("confirm");
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      dead = true;
    };
  }, [userinfo, startedAt, isEditing]);

  if (!userinfo && !isEditing) return null;

  const toggle = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const handleSuggestKeywords = async () => {
    if (!refineNote.trim()) return;
    setKeywordLoading(true);
    setKeywordError(null);
    try {
      const tags = await extractKeywords(refineNote);
      // Merge new suggestions in, dedupe with existing
      setSuggestedKeywords((prev) => {
        const seen = new Set(prev);
        const merged = [...prev];
        for (const t of tags) {
          if (!seen.has(t)) {
            seen.add(t);
            merged.push(t);
          }
        }
        return merged;
      });
      // Auto-add the new suggestions to active keywords. The user can untoggle
      // any they don't like. This makes the AI feel "active" rather than
      // requiring a second click for everything.
      setKeywords((prev) => {
        const seen = new Set(prev);
        const merged = [...prev];
        for (const t of tags) {
          if (!seen.has(t)) {
            seen.add(t);
            merged.push(t);
          }
        }
        return merged;
      });
    } catch (e) {
      setKeywordError(e instanceof Error ? e.message : String(e));
    } finally {
      setKeywordLoading(false);
    }
  };

  const confirm = () => {
    const identity = userinfo
      ? {
          name: userinfo.name,
          email: userinfo.email,
          picture: userinfo.picture ?? "",
        }
      : {
          name: editingMatch?.name ?? "",
          email: editingMatch?.email ?? "",
          picture: editingMatch?.picture ?? "",
        };
    onConfirm({
      ...identity,
      city,
      sectors,
      stages,
      lookingFor,
      distanceMaxMiles,
      keywords,
      evidence: [
        ...(inferred?.evidence ?? editingMatch?.evidence ?? []),
        ...(refineNote ? [`User added: "${refineNote}"`] : []),
      ],
    });
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,44,79,0.42)",
        backdropFilter: "blur(2px)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card fade-in"
        style={{
          width: "min(560px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 0,
          background: "var(--white)",
          borderTop: "3px solid var(--nucleus-blue)",
        }}
      >
        {phase === "reading" && userinfo && (
          <ReadingPhase userinfo={userinfo} error={error} />
        )}
        {phase === "confirm" && inferred && (
          <ConfirmPhase
            identity={
              userinfo
                ? {
                    name: userinfo.name,
                    email: userinfo.email,
                    picture: userinfo.picture ?? "",
                    given_name: userinfo.given_name,
                  }
                : {
                    name: editingMatch?.name ?? "",
                    email: editingMatch?.email ?? "",
                    picture: editingMatch?.picture ?? "",
                  }
            }
            isEditing={isEditing}
            inferred={inferred}
            city={city}
            setCity={setCity}
            sectors={sectors}
            setSectors={setSectors}
            stages={stages}
            setStages={setStages}
            lookingFor={lookingFor}
            setLookingFor={setLookingFor}
            distanceMaxMiles={distanceMaxMiles}
            setDistanceMaxMiles={setDistanceMaxMiles}
            refineNote={refineNote}
            setRefineNote={setRefineNote}
            keywords={keywords}
            setKeywords={setKeywords}
            suggestedKeywords={suggestedKeywords}
            keywordLoading={keywordLoading}
            keywordError={keywordError}
            onSuggestKeywords={handleSuggestKeywords}
            onCancel={onCancel}
            onConfirm={confirm}
            toggle={toggle}
          />
        )}
      </div>
    </div>
  );
}

function ReadingPhase({
  userinfo,
  error,
}: {
  userinfo: LinkedInUserinfo;
  error: string | null;
}) {
  return (
    <div style={{ padding: "36px 32px 32px", textAlign: "center" }}>
      <div
        style={{
          width: 220,
          height: 220,
          margin: "0 auto 18px",
          background: "var(--pearl-100)",
          borderRadius: 16,
          border: "1px solid var(--color-border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ParticleNetwork size={220} nodeCount={22} />
      </div>
      <div className="tiny-caps" style={{ color: "var(--nucleus-blue)", marginBottom: 6 }}>
        Reading your profile
      </div>
      <h2
        className="display"
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.012em",
          color: "var(--nucleus-blue)",
          margin: "0 0 8px",
          lineHeight: 1.2,
        }}
      >
        Hi, {userinfo.given_name || userinfo.name.split(" ")[0]}
      </h2>
      <p style={{ color: "var(--slate)", fontSize: 13.5, margin: 0 }}>
        Looking up your public footprint to draft your interests…
      </p>
      {error && (
        <div
          style={{
            marginTop: 18,
            padding: "10px 14px",
            background: "#fbe8e0",
            color: "#8a3a3a",
            borderRadius: 8,
            fontSize: 12.5,
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

interface DisplayIdentity {
  name: string;
  email: string;
  picture: string;
  given_name?: string;
}

interface ConfirmPhaseProps {
  identity: DisplayIdentity;
  isEditing: boolean;
  inferred: InferredInterests;
  city: string;
  setCity: (v: string) => void;
  sectors: string[];
  setSectors: (v: string[]) => void;
  stages: string[];
  setStages: (v: string[]) => void;
  lookingFor: UserMatch["lookingFor"];
  setLookingFor: (v: UserMatch["lookingFor"]) => void;
  distanceMaxMiles: number | null;
  setDistanceMaxMiles: (v: number | null) => void;
  refineNote: string;
  setRefineNote: (v: string) => void;
  keywords: string[];
  setKeywords: (v: string[] | ((prev: string[]) => string[])) => void;
  suggestedKeywords: string[];
  keywordLoading: boolean;
  keywordError: string | null;
  onSuggestKeywords: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  toggle: <T extends string>(arr: T[], v: T) => T[];
}

function ConfirmPhase({
  identity,
  isEditing,
  inferred,
  city,
  setCity,
  sectors,
  setSectors,
  stages,
  setStages,
  lookingFor,
  setLookingFor,
  distanceMaxMiles,
  setDistanceMaxMiles,
  refineNote,
  setRefineNote,
  keywords,
  setKeywords,
  suggestedKeywords,
  keywordLoading,
  keywordError,
  onSuggestKeywords,
  onCancel,
  onConfirm,
  toggle,
}: ConfirmPhaseProps) {
  return (
    <div style={{ padding: "26px 28px 26px" }}>
      {/* — header — */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          paddingBottom: 18,
          borderBottom: "1px solid var(--color-border-soft)",
          marginBottom: 18,
        }}
      >
        {identity.picture && (
          <img
            src={identity.picture}
            alt={identity.name}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--color-border)",
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tiny-caps" style={{ color: "var(--nucleus-blue)" }}>
            {isEditing ? "Edit your interests" : "Is this you?"}
          </div>
          <div
            className="display"
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--nucleus-blue)",
              lineHeight: 1.2,
              marginTop: 2,
            }}
          >
            {identity.name}
          </div>
          {identity.email && (
            <div style={{ fontSize: 12, color: "var(--slate)" }}>{identity.email}</div>
          )}
        </div>
      </div>

      {/* — evidence — */}
      {inferred.evidence.length > 0 && (
        <div
          style={{
            background: "var(--pearl-100)",
            border: "1px solid var(--color-border-soft)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 18,
          }}
        >
          <div className="tiny-caps" style={{ marginBottom: 6 }}>
            What we found
          </div>
          {inferred.evidence.map((e, i) => (
            <div
              key={i}
              style={{
                fontSize: 12.5,
                color: "var(--charcoal)",
                lineHeight: 1.5,
                padding: "2px 0",
              }}
            >
              · {e}
            </div>
          ))}
        </div>
      )}

      {/* — city — */}
      <FieldGroup label="City">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={selectInline}
        >
          {!UTAH_CITIES.includes(city) && city && <option value={city}>{city}</option>}
          {UTAH_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* — sectors — */}
      <FieldGroup label="Sector interest">
        <ChipRow
          options={SECTOR_OPTIONS}
          selected={sectors}
          onToggle={(v) => setSectors(toggle(sectors, v))}
        />
      </FieldGroup>

      {/* — stage — */}
      <FieldGroup label="Stage you care about">
        <ChipRow
          options={STAGE_OPTIONS}
          selected={stages}
          onToggle={(v) => setStages(toggle(stages, v))}
        />
      </FieldGroup>

      {/* — looking for — */}
      <FieldGroup label="What are you looking for?">
        <ChipRow
          options={LOOKING_FOR_OPTIONS}
          selected={lookingFor as string[]}
          onToggle={(v) =>
            setLookingFor(toggle(lookingFor as string[], v) as UserMatch["lookingFor"])
          }
        />
      </FieldGroup>

      <FieldGroup label={`Distance from ${city || "your city"}`}>
        <DistanceRow value={distanceMaxMiles} setValue={setDistanceMaxMiles} />
      </FieldGroup>

      {/* — free text + LLM keyword extraction — */}
      <FieldGroup label="Anything else? (optional)">
        <textarea
          rows={3}
          placeholder="e.g. I'm a solo founder in St. George looking to connect with manufacturing partners and need help with FDA clearance…"
          value={refineNote}
          onChange={(e) => setRefineNote(e.target.value)}
          style={{
            ...selectInline,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--slate)", lineHeight: 1.4 }}>
            ✦ The more detail you write, the more accurately our AI can match you.
          </span>
          <button
            type="button"
            onClick={onSuggestKeywords}
            disabled={!refineNote.trim() || keywordLoading}
            className="btn btn-ghost"
            style={{ padding: "5px 11px", fontSize: 11.5 }}
          >
            {keywordLoading ? "Thinking…" : "Suggest keywords ✦"}
          </button>
        </div>
        {keywordError && (
          <div style={{ fontSize: 11, color: "#8a3a3a", marginTop: 6 }}>
            ⚠ {keywordError}
          </div>
        )}
        {(suggestedKeywords.length > 0 || keywords.length > 0) && (
          <div style={{ marginTop: 10 }}>
            <div className="tiny-caps" style={{ marginBottom: 6 }}>
              Keywords (click to toggle)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {/* show all known keywords (suggested + manual) — active ones blue */}
              {Array.from(new Set([...keywords, ...suggestedKeywords])).map(
                (k) => {
                  const on = keywords.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() =>
                        setKeywords((prev) =>
                          prev.includes(k)
                            ? prev.filter((x) => x !== k)
                            : [...prev, k],
                        )
                      }
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        border: `1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
                        background: on ? "var(--nucleus-blue)" : "var(--white)",
                        color: on ? "var(--wasatch-whisper)" : "var(--charcoal)",
                        cursor: "pointer",
                      }}
                    >
                      {k}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        )}
      </FieldGroup>

      {/* — actions — */}
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button onClick={onCancel} className="btn btn-ghost">
          Skip
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onConfirm} className="btn btn-primary">
          Show my matches →
        </button>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="tiny-caps" style={{ marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

interface ChipRowProps {
  options: string[] | Array<[string, string]>;
  selected: string[];
  onToggle: (v: string) => void;
}

function ChipRow({ options, selected, onToggle }: ChipRowProps) {
  const items = (typeof options[0] === "string"
    ? (options as string[]).map((s) => [s, s] as [string, string])
    : (options as Array<[string, string]>));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map(([val, label]) => {
        const on = selected.includes(val);
        return (
          <button
            key={val}
            type="button"
            onClick={() => onToggle(val)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 500,
              border: `1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
              background: on ? "var(--nucleus-blue)" : "var(--white)",
              color: on ? "var(--wasatch-whisper)" : "var(--charcoal)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const selectInline: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--white)",
  fontSize: 13,
  color: "var(--charcoal)",
};

const DISTANCE_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: null, label: "Statewide" },
];

interface DistanceRowProps {
  value: number | null;
  setValue: (v: number | null) => void;
}

function DistanceRow({ value, setValue }: DistanceRowProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {DISTANCE_OPTIONS.map((opt) => {
        const on = opt.value === value;
        const key = opt.value === null ? "statewide" : String(opt.value);
        return (
          <button
            key={key}
            type="button"
            onClick={() => setValue(opt.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 500,
              border: `1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
              background: on ? "var(--nucleus-blue)" : "var(--white)",
              color: on ? "var(--wasatch-whisper)" : "var(--charcoal)",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
