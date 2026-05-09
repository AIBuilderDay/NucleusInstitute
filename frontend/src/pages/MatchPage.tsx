import { useEffect, useState } from "react";
import type {
  CompareResponse,
  MatchResponse,
  MatchResult,
  Person,
  Sector,
  Startup,
} from "../types";
import {
  PEOPLE,
  SECTORS,
  SECTOR_LABEL,
  STAGE_LABEL,
  STARTUPS,
  api,
} from "../data";
import { Avatar, DimensionBars, Field, ScoreArc, selectStyle } from "../components/ui";

interface MatchPageProps {
  initialPerson: Person | null;
  initialStartup: Startup | null;
  currentUser: Person;
}

type Direction = "person_to_startups" | "startup_to_people";

export function MatchPage({ initialPerson, initialStartup, currentUser }: MatchPageProps) {
  const [direction, setDirection] = useState<Direction>(
    initialStartup ? "startup_to_people" : "person_to_startups",
  );
  const [personId, setPersonId] = useState<string>(
    initialPerson?.id ?? currentUser.id ?? PEOPLE[0]!.id,
  );
  const [startupId, setStartupId] = useState<string>(
    initialStartup?.id ?? STARTUPS[0]!.id,
  );
  const [topK, setTopK] = useState(8);
  const [matcher, setMatcher] = useState("");
  const [sectorFilter, setSectorFilter] = useState<Sector[]>([]);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
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
      setLoading(true);
      setCompare(null);
      let r: MatchResponse;
      if (direction === "person_to_startups") {
        r = await api.matchPerson(personId, {
          topK,
          sectorFilter,
          matcher: matcher || undefined,
        });
      } else {
        r = await api.matchStartup(startupId, { topK });
      }
      if (!dead) {
        setResults(r);
        setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [direction, personId, startupId, topK, matcher, sectorFilter]);

  const me = PEOPLE.find((p) => p.id === personId);
  const su = STARTUPS.find((s) => s.id === startupId);

  const runCompare = async () => {
    if (direction !== "person_to_startups") return;
    setLoading(true);
    const r = await api.compare(personId, { topK });
    setCompare(r);
    setLoading(false);
  };

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
              { id: "person_to_startups", l: "I'm a person" },
              { id: "startup_to_people", l: "I'm a startup" },
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

          {direction === "person_to_startups" ? (
            <Field label="I am…" hint="Auto-loaded from Browse.">
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                style={selectStyle}
              >
                {PEOPLE.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role_category.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="The startup is…">
              <select
                value={startupId}
                onChange={(e) => setStartupId(e.target.value)}
                style={selectStyle}
              >
                {STARTUPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {SECTOR_LABEL[s.sector]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {direction === "person_to_startups" && (
            <Field label="Looking for sectors" hint="Optional. Empty = all.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SECTORS.map((s) => {
                  const on = sectorFilter.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        setSectorFilter(
                          on ? sectorFilter.filter((x) => x !== s) : [...sectorFilter, s],
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 500,
                        border: `1px solid ${on ? "var(--copper)" : "var(--color-border)"}`,
                        background: on ? "var(--copper-faint)" : "var(--white)",
                        color: on ? "#8a5e1f" : "var(--charcoal)",
                      }}
                    >
                      {SECTOR_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

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
              <option value="embedding">embedding (TO-DO)</option>
              <option value="agentic">agentic (TO-DO)</option>
            </select>
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}>
              Find matches
            </button>
            <button
              className="btn btn-ghost"
              onClick={runCompare}
              disabled={direction !== "person_to_startups"}
            >
              Compare matchers
            </button>
          </div>

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
            {direction === "person_to_startups" && me && (
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
            {direction === "startup_to_people" && su && (
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
          {loading && !results && <ResultSkeleton />}

          {compare && <CompareResults compare={compare} />}

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
                  {results.matches.length} ranked matches
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="tiny-caps">Source</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background:
                        results.source === "live"
                          ? "var(--copper-faint)"
                          : "var(--whisper-200)",
                      color: results.source === "live" ? "#8a5e1f" : "var(--slate)",
                    }}
                  >
                    {results.source === "live" ? "LIVE BACKEND" : "MOCK"}
                  </span>
                </div>
              </div>

              {results.matches.map((m, i) => (
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

interface MatchCardProps {
  match: MatchResult;
  index: number;
  direction: Direction;
  expanded: boolean;
  onToggle: () => void;
}

function MatchCard({ match, index, direction, expanded, onToggle }: MatchCardProps) {
  const isStartup = direction === "person_to_startups";
  const target: Person | Startup | undefined = isStartup
    ? match.startup ?? STARTUPS.find((s) => s.id === match.startup_id)
    : match.person ?? PEOPLE.find((p) => p.id === match.talent_id);
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
                : (target as Person).headline}
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

function CompareResults({ compare }: { compare: CompareResponse }) {
  const matchers = Object.keys(compare.by_matcher) as Array<keyof typeof compare.by_matcher>;
  return (
    <div>
      <h2
        className="display"
        style={{ fontSize: 26, color: "var(--nucleus-blue)", margin: "0 0 6px" }}
      >
        Side-by-side
      </h2>
      <p style={{ color: "var(--slate)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        Same talent. Three matchers. Compare top picks across rule-based, embedding, and agentic
        providers.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${matchers.length}, 1fr)`,
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
                top {compare.by_matcher[m].length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {compare.by_matcher[m].slice(0, 6).map((mm, i) => {
                const t = mm.startup ?? STARTUPS.find((s) => s.id === mm.startup_id);
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
