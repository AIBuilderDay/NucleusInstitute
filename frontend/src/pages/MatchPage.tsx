import { useEffect, useMemo, useState } from "react";
import type {
  CompareResponse,
  MatchResponse,
  MatchResult,
  Network,
  Person,
  RoleCategory,
  Sector,
  Stage,
  Startup,
} from "../types";
import { api, hydrateMatches } from "../api";
import {
  NETWORK_LABEL,
  NETWORKS,
  ROLE_CATEGORIES,
  ROLE_CATEGORY_LABEL,
  SECTORS,
  SECTOR_LABEL,
  STAGES,
  STAGE_LABEL,
} from "../labels";
import { Avatar, DimensionBars, Field, ScoreArc, selectStyle } from "../components/ui";

interface MatchPageProps {
  people: Person[];
  startups: Startup[];
  initialPerson: Person | null;
  initialStartup: Startup | null;
  currentUser: Person;
}

type Direction = "person_to_startups" | "startup_to_people";

// Intents express *what kind of opportunity* a person is looking for from a
// startup. They map to fields the backend already returns on Startup, so
// filtering happens client-side post-match.
type Intent = "hiring" | "fundraising" | "advisor_seats" | "board_seats" | "needs_services";

const INTENT_LABEL: Record<Intent, string> = {
  hiring: "Hiring",
  fundraising: "Fundraising",
  advisor_seats: "Open advisor seat",
  board_seats: "Open board seat",
  needs_services: "Needs services",
};

const INTENTS: Intent[] = [
  "hiring",
  "fundraising",
  "advisor_seats",
  "board_seats",
  "needs_services",
];

function startupMatchesIntent(s: Startup, intent: Intent): boolean {
  switch (intent) {
    case "hiring":
      return s.roles_needed.length > 0;
    case "fundraising":
      return !!s.seeking_investment;
    case "advisor_seats":
      // advisor_slots_open is on the backend schema but optional on the type.
      return ((s as unknown as { advisor_slots_open?: number }).advisor_slots_open ?? 0) > 0;
    case "board_seats":
      return ((s as unknown as { board_seats_open?: number }).board_seats_open ?? 0) > 0;
    case "needs_services":
      return ((s as unknown as { services_needed?: string[] }).services_needed ?? []).length > 0;
  }
}

export function MatchPage({
  people,
  startups,
  initialPerson,
  initialStartup,
  currentUser,
}: MatchPageProps) {
  const [direction, setDirection] = useState<Direction>(
    initialStartup ? "startup_to_people" : "person_to_startups",
  );
  const [personId, setPersonId] = useState<string>(
    initialPerson?.id ?? currentUser.id ?? people[0]?.id ?? "",
  );
  const [startupId, setStartupId] = useState<string>(
    initialStartup?.id ?? startups[0]?.id ?? "",
  );
  const [topK, setTopK] = useState(8);
  const [matcher, setMatcher] = useState("");
  const [sectorFilter, setSectorFilter] = useState<Sector[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage[]>([]);
  const [intentFilter, setIntentFilter] = useState<Intent[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleCategory[]>([]);
  const [networkFilter, setNetworkFilter] = useState<Network[]>([]);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (initialPerson) {
      setDirection("person_to_startups");
      setPersonId(initialPerson.id);
    }
    if (initialStartup) {
      setDirection("startup_to_people");
      setStartupId(initialStartup.id);
    }
  }, [initialPerson, initialStartup]);

  useEffect(() => {
    let dead = false;
    void (async () => {
      if (!personId && !startupId) return;
      setLoading(true);
      setError(null);
      setCompare(null);
      try {
        const r =
          direction === "person_to_startups"
            ? await api.matchPerson(personId, { topK, matcher: matcher || undefined })
            : await api.matchStartup(startupId, { topK, matcher: matcher || undefined });
        if (dead) return;
        const hydrated: MatchResponse = {
          ...r,
          matches: hydrateMatches(r.matches, people, startups),
        };
        setResults(hydrated);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [direction, personId, startupId, topK, matcher, people, startups]);

  const me = useMemo(() => people.find((p) => p.id === personId), [people, personId]);
  const su = useMemo(() => startups.find((s) => s.id === startupId), [startups, startupId]);

  // Apply client-side filters to the already-fetched matches. Backend hard
  // filters already stripped role-category / availability / comp / location
  // mismatches; these filters narrow the survivors by *intent* and *category*.
  const displayedMatches = useMemo<MatchResult[]>(() => {
    if (!results) return [];
    return results.matches.filter((m) => {
      if (direction === "person_to_startups") {
        const s = m.startup;
        if (!s) return false;
        if (sectorFilter.length) {
          const sectors = [s.sector, ...(s.sectors_secondary ?? [])];
          if (!sectors.some((x) => sectorFilter.includes(x))) return false;
        }
        if (stageFilter.length && !stageFilter.includes(s.stage)) return false;
        if (intentFilter.length && !intentFilter.some((i) => startupMatchesIntent(s, i)))
          return false;
      } else {
        const p = m.person;
        if (!p) return false;
        if (roleFilter.length && !roleFilter.includes(p.role_category)) return false;
        if (networkFilter.length && !networkFilter.includes(p.primary_network)) return false;
        if (sectorFilter.length && !p.sectors_of_interest.some((s) => sectorFilter.includes(s)))
          return false;
      }
      return true;
    });
  }, [results, direction, sectorFilter, stageFilter, intentFilter, roleFilter, networkFilter]);

  const runCompare = async () => {
    if (!personId && !startupId) return;
    setLoading(true);
    setError(null);
    try {
      const r =
        direction === "person_to_startups"
          ? await api.compare(personId, { topK })
          : await api.compareStartup(startupId, { topK });
      const hydrated: CompareResponse = {
        ...r,
        by_matcher: Object.fromEntries(
          Object.entries(r.by_matcher).map(([k, v]) => [k, hydrateMatches(v, people, startups)]),
        ),
      };
      setCompare(hydrated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  function toggle<V>(arr: V[], set: (v: V[]) => void, val: V) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const isPersonDir = direction === "person_to_startups";
  const filtersActive =
    sectorFilter.length +
      stageFilter.length +
      intentFilter.length +
      roleFilter.length +
      networkFilter.length >
    0;

  return (
    <div>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "28px 32px 64px",
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 24,
        }}
      >
        <aside
          className="card"
          style={{ padding: 22, alignSelf: "start", position: "sticky", top: 88 }}
        >
          <div className="tiny-caps">Find Matches</div>
          <h3
            className="display"
            style={{ margin: "6px 0 18px", fontSize: 24, color: "var(--nucleus-blue)" }}
          >
            Configure
          </h3>

          <div
            style={{
              display: "flex",
              background: "var(--whisper-200)",
              borderRadius: 8,
              padding: 3,
              marginBottom: 18,
            }}
          >
            {([
              { id: "person_to_startups", l: "Find startups" },
              { id: "startup_to_people", l: "Find people" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setDirection(t.id)}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  background: direction === t.id ? "var(--white)" : "transparent",
                  color: direction === t.id ? "var(--nucleus-blue)" : "var(--slate)",
                }}
              >
                {t.l}
              </button>
            ))}
          </div>

          {isPersonDir ? (
            <Field label="I am…" hint="The talent searching for startups.">
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                style={selectStyle}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {ROLE_CATEGORY_LABEL[p.role_category]}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="The startup is…" hint="Whose perspective are we searching from.">
              <select
                value={startupId}
                onChange={(e) => setStartupId(e.target.value)}
                style={selectStyle}
              >
                {startups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {SECTOR_LABEL[s.sector]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* — Direction-specific filters — */}
          {isPersonDir && (
            <>
              <Field label="Show startups that are…" hint="Multiple OK. Empty = any opportunity.">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {INTENTS.map((i) => (
                    <ToggleChip
                      key={i}
                      on={intentFilter.includes(i)}
                      onClick={() => toggle(intentFilter, setIntentFilter, i)}
                      tone="copper"
                    >
                      {INTENT_LABEL[i]}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
              <Field label="Stage" hint="Optional.">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {STAGES.map((s) => (
                    <ToggleChip
                      key={s}
                      on={stageFilter.includes(s)}
                      onClick={() => toggle(stageFilter, setStageFilter, s)}
                    >
                      {STAGE_LABEL[s]}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            </>
          )}

          {!isPersonDir && (
            <>
              <Field label="Looking for…" hint="Filter results by role category.">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ROLE_CATEGORIES.map((r) => (
                    <ToggleChip
                      key={r}
                      on={roleFilter.includes(r)}
                      onClick={() => toggle(roleFilter, setRoleFilter, r)}
                      tone="copper"
                    >
                      {ROLE_CATEGORY_LABEL[r]}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
              <Field label="Network" hint="Self-declared Nucleus bucket.">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {NETWORKS.map((n) => (
                    <ToggleChip
                      key={n}
                      on={networkFilter.includes(n)}
                      onClick={() => toggle(networkFilter, setNetworkFilter, n)}
                    >
                      {NETWORK_LABEL[n].replace(" Network", "").replace(" Advisory", " Advisor")}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field
            label={isPersonDir ? "Sector" : "Sector interest"}
            hint="Optional. Empty = all."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SECTORS.map((s) => (
                <ToggleChip
                  key={s}
                  on={sectorFilter.includes(s)}
                  onClick={() => toggle(sectorFilter, setSectorFilter, s)}
                >
                  {SECTOR_LABEL[s]}
                </ToggleChip>
              ))}
            </div>
          </Field>

          <Field label="Top K">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range"
                min={3}
                max={20}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                style={{ flex: 1 }}
              />
              <span className="mono" style={{ minWidth: 24, textAlign: "right" }}>
                {topK}
              </span>
            </div>
          </Field>

          <Field label="Matcher" hint="Provider override (default = rule_filter).">
            <select
              value={matcher}
              onChange={(e) => setMatcher(e.target.value)}
              style={selectStyle}
            >
              <option value="">(default)</option>
              <option value="rule_filter">rule_filter</option>
              <option value="embedding">embedding</option>
              <option value="agentic">agentic</option>
            </select>
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}>
              Find matches
            </button>
            <button className="btn btn-ghost" onClick={runCompare}>
              Compare matchers
            </button>
          </div>

          {filtersActive && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 10, width: "100%", fontSize: 12 }}
              onClick={() => {
                setSectorFilter([]);
                setStageFilter([]);
                setIntentFilter([]);
                setRoleFilter([]);
                setNetworkFilter([]);
              }}
            >
              Clear filters
            </button>
          )}

          <div
            style={{
              marginTop: 18,
              padding: "12px 14px",
              background: "var(--whisper-50)",
              borderRadius: 8,
              border: "1px solid var(--color-border-soft)",
            }}
          >
            <div className="tiny-caps">Querying for</div>
            {isPersonDir && me && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <Avatar name={me.name} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{me.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--slate)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {me.headline}
                  </div>
                </div>
              </div>
            )}
            {!isPersonDir && su && (
              <div style={{ marginTop: 8 }}>
                <div className="display" style={{ fontSize: 18, color: "var(--nucleus-blue)" }}>
                  {su.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate)" }}>{su.one_liner}</div>
              </div>
            )}
          </div>
        </aside>

        <main>
          {error && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 8,
                background: "#fbe8e0",
                color: "#8a3a3a",
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              ⚠ Match request failed: {error}
            </div>
          )}

          {loading && !results && <ResultSkeleton />}

          {compare && <CompareResults compare={compare} direction={direction} />}

          {!compare && results && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 14,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <h2
                  className="display"
                  style={{ fontSize: 26, color: "var(--nucleus-blue)", margin: 0 }}
                >
                  {displayedMatches.length}{" "}
                  {filtersActive ? `of ${results.matches.length} ` : ""}ranked matches
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="tiny-caps">Source</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "var(--copper-faint)",
                      color: "#8a5e1f",
                    }}
                  >
                    LIVE BACKEND
                  </span>
                </div>
              </div>

              {displayedMatches.length === 0 && (
                <div
                  className="card"
                  style={{ padding: 24, color: "var(--slate)", fontSize: 13.5 }}
                >
                  No matches passed the active filters. Try clearing one or two of them.
                </div>
              )}

              {displayedMatches.map((m, i) => (
                <MatchCard
                  key={`${m.talent_id}-${m.startup_id}-${i}`}
                  match={m}
                  index={i + 1}
                  direction={direction}
                  expanded={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                />
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

interface ToggleChipProps {
  on: boolean;
  onClick: () => void;
  tone?: "blue" | "copper";
  children: React.ReactNode;
}

function ToggleChip({ on, onClick, tone = "blue", children }: ToggleChipProps) {
  const onColor = tone === "copper" ? "var(--copper)" : "var(--nucleus-blue)";
  const onBg = tone === "copper" ? "var(--copper-faint)" : "var(--blue-100)";
  const onText = tone === "copper" ? "#8a5e1f" : "var(--nucleus-blue)";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        border: `1px solid ${on ? onColor : "var(--color-border)"}`,
        background: on ? onBg : "var(--white)",
        color: on ? onText : "var(--charcoal)",
      }}
    >
      {children}
    </button>
  );
}

interface MatchCardProps {
  match: MatchResult;
  index: number;
  direction: Direction;
  expanded: boolean;
  onToggle: () => void;
}

function MatchCard({ match, index, direction, expanded, onToggle }: MatchCardProps) {
  const isStartup = direction === "person_to_startups";
  const target: Person | Startup | undefined = isStartup ? match.startup : match.person;
  if (!target) return null;
  const blocked = !match.passed_hard_filters;

  return (
    <div
      className="card fade-in"
      style={{
        padding: 20,
        marginBottom: 12,
        opacity: blocked ? 0.66 : 1,
        borderColor: blocked ? "var(--whisper-300)" : "var(--color-border-soft)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 18,
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--slate-light)" }}>
            #{String(index).padStart(2, "0")}
          </span>
          <ScoreArc score={match.score} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span
              className="display"
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: isStartup ? "var(--nucleus-blue)" : "var(--charcoal)",
              }}
            >
              {target.name}
            </span>
            <span style={{ fontSize: 12, color: "var(--slate)" }}>
              ·{" "}
              {isStartup
                ? `${SECTOR_LABEL[(target as Startup).sector]} · ${STAGE_LABEL[(target as Startup).stage]} · ${target.location_city}`
                : `${ROLE_CATEGORY_LABEL[(target as Person).role_category]} · ${(target as Person).headline}`}
            </span>
          </div>
          {!isStartup && (
            <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>
              {target.location_city} · {(target as Person).years_experience}y
            </div>
          )}
          {isStartup && (
            <div style={{ fontSize: 13.5, color: "var(--charcoal)", marginTop: 6 }}>
              {(target as Startup).one_liner}
            </div>
          )}

          {match.reasons.length > 0 && (
            <ul
              style={{
                margin: "12px 0 6px",
                paddingLeft: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {match.reasons.slice(0, expanded ? 8 : 3).map((r, i) => (
                <li
                  key={i}
                  style={{ fontSize: 13, color: "var(--charcoal)", display: "flex", gap: 8 }}
                >
                  <span style={{ color: "var(--copper)", fontWeight: 600 }}>+</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {match.blockers.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
              {match.blockers.map((b, i) => (
                <li
                  key={i}
                  style={{ fontSize: 13, color: "#8a3a3a", display: "flex", gap: 8 }}
                >
                  <span style={{ fontWeight: 600 }}>✕</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 10 }}>
          {expanded && <DimensionBars dims={match.dimension_scores} />}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              onClick={onToggle}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              {expanded ? "Less" : "Breakdown"}
            </button>
            {!blocked && (
              <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Introduce →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareResults({
  compare,
  direction,
}: {
  compare: CompareResponse;
  direction: Direction;
}) {
  const matchers = Object.keys(compare.by_matcher);
  const isStartup = direction === "person_to_startups";
  return (
    <div>
      <h2
        className="display"
        style={{ fontSize: 26, color: "var(--nucleus-blue)", margin: "0 0 6px" }}
      >
        Side-by-side
      </h2>
      <p style={{ color: "var(--slate)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        Same query. Every registered matcher. Compare top picks across rule-based, embedding,
        and agentic providers.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, matchers.length)}, 1fr)`,
          gap: 14,
        }}
      >
        {matchers.map((m) => (
          <div key={m} className="card" style={{ padding: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span className="display" style={{ fontSize: 15, color: "var(--nucleus-blue)" }}>
                {m}
              </span>
              <span className="mono" style={{ fontSize: 10, color: "var(--slate-light)" }}>
                top {compare.by_matcher[m]?.length ?? 0}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(compare.by_matcher[m] ?? []).slice(0, 6).map((mm, i) => {
                const t = isStartup ? mm.startup : mm.person;
                if (!t) return null;
                return (
                  <div
                    key={`${m}-${i}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      background: "var(--whisper-50)",
                      borderRadius: 6,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--slate-light)" }}>
                      #{i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--charcoal)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: mm.score >= 0.7 ? "var(--copper)" : "var(--slate)",
                      }}
                    >
                      {Math.round(mm.score * 100)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="card"
          style={{ padding: 20, display: "grid", gridTemplateColumns: "72px 1fr 240px", gap: 18 }}
        >
          <div className="shimmer" style={{ height: 72, width: 72, borderRadius: "50%" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="shimmer" style={{ height: 18, width: "60%" }} />
            <div className="shimmer" style={{ height: 12, width: "82%" }} />
            <div className="shimmer" style={{ height: 12, width: "40%" }} />
          </div>
          <div className="shimmer" style={{ height: 60, width: "100%" }} />
        </div>
      ))}
    </div>
  );
}
