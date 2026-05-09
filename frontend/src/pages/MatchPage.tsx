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
import { Avatar, DimensionBars, Field, ScoreArc, selectClass } from "../components/ui";

interface MatchPageProps {
  people: Person[];
  startups: Startup[];
  initialPerson: Person | null;
  initialStartup: Startup | null;
  currentUser: Person;
  connectedPersonIds: Set<string>;
  connectedStartupIds: Set<string>;
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
  connectedPersonIds,
  connectedStartupIds,
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
  const [connectedOnly, setConnectedOnly] = useState(false);
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
        if (connectedOnly && !connectedStartupIds.has(s.id)) return false;
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
        if (connectedOnly && !connectedPersonIds.has(p.id)) return false;
        if (roleFilter.length && !roleFilter.includes(p.role_category)) return false;
        if (networkFilter.length && !networkFilter.includes(p.primary_network)) return false;
        if (sectorFilter.length && !p.sectors_of_interest.some((s) => sectorFilter.includes(s)))
          return false;
      }
      return true;
    });
  }, [results, direction, sectorFilter, stageFilter, intentFilter, roleFilter, networkFilter, connectedOnly, connectedPersonIds, connectedStartupIds]);

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
      0 || connectedOnly;

  return (
    <div>
      <div className="max-w-[1440px] mx-auto pt-28 px-32 pb-64 grid grid-cols-[380px_1fr] gap-24">
        <aside className="card p-22 self-start sticky top-88">
          <div className="tiny-caps">Find Matches</div>
          <h3 className="font-display mt-6 mb-18 text-[24px] text-nucleus-blue">
            Configure
          </h3>

          <div className="flex bg-pearl-200 rounded-[8px] p-3 mb-18">
            {([
              { id: "person_to_startups", l: "Find startups" },
              { id: "startup_to_people", l: "Find people" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setDirection(t.id)}
                className={`flex-1 py-7 px-10 rounded-[6px] text-[12px] font-medium ${
                  direction === t.id
                    ? "bg-white text-nucleus-blue"
                    : "bg-transparent text-graphite-muted"
                }`}
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
                className={selectClass}
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
                className={selectClass}
              >
                {startups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {SECTOR_LABEL[s.sector]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label="Connected"
            hint={`Only show ${isPersonDir ? "startups" : "people"} you connected with on Explore.`}
          >
            <div className="flex gap-6 items-center">
              <ToggleChip
                on={connectedOnly}
                onClick={() => setConnectedOnly((v) => !v)}
                tone="copper"
              >
                Connected only
                {isPersonDir
                  ? ` (${connectedStartupIds.size})`
                  : ` (${connectedPersonIds.size})`}
              </ToggleChip>
            </div>
          </Field>

          {/* — Direction-specific filters — */}
          {isPersonDir && (
            <>
              <Field label="Show startups that are…" hint="Multiple OK. Empty = any opportunity.">
                <div className="flex flex-wrap gap-6">
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
                <div className="flex flex-wrap gap-6">
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
                <div className="flex flex-wrap gap-6">
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
                <div className="flex flex-wrap gap-6">
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
            <div className="flex flex-wrap gap-6">
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
            <div className="flex items-center gap-12">
              <input
                type="range"
                min={3}
                max={20}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="flex-1"
              />
              <span className="font-mono min-w-24 text-right">
                {topK}
              </span>
            </div>
          </Field>

          <Field label="Matcher" hint="Provider override (default = rule_filter).">
            <select
              value={matcher}
              onChange={(e) => setMatcher(e.target.value)}
              className={selectClass}
            >
              <option value="">(default)</option>
              <option value="rule_filter">rule_filter</option>
              <option value="embedding">embedding</option>
              <option value="agentic">agentic</option>
            </select>
          </Field>

          <div className="flex gap-8 mt-8">
            <button className="btn btn-primary flex-1">
              Find matches
            </button>
            <button className="btn btn-ghost" onClick={runCompare}>
              Compare matchers
            </button>
          </div>

          {filtersActive && (
            <button
              className="btn btn-ghost mt-10 w-full text-[12px]"
              onClick={() => {
                setSectorFilter([]);
                setStageFilter([]);
                setIntentFilter([]);
                setRoleFilter([]);
                setNetworkFilter([]);
                setConnectedOnly(false);
              }}
            >
              Clear filters
            </button>
          )}

          <div className="mt-18 py-12 px-14 bg-pearl rounded-[8px] border border-pearl-200">
            <div className="tiny-caps">Querying for</div>
            {isPersonDir && me && (
              <div className="flex items-center gap-10 mt-8">
                <Avatar name={me.name} size={36} />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{me.name}</div>
                  <div className="text-[11px] text-graphite-muted whitespace-nowrap overflow-hidden text-ellipsis">
                    {me.headline}
                  </div>
                </div>
              </div>
            )}
            {!isPersonDir && su && (
              <div className="mt-8">
                <div className="font-display text-[18px] text-nucleus-blue">
                  {su.name}
                </div>
                <div className="text-[12px] text-graphite-muted">{su.one_liner}</div>
              </div>
            )}
          </div>
        </aside>

        <main>
          {error && (
            <div className="py-14 px-18 rounded-[8px] bg-[#fbe8e0] text-[#8a3a3a] text-[13px] mb-14">
              ⚠ Match request failed: {error}
            </div>
          )}

          {loading && !results && <ResultSkeleton />}

          {compare && <CompareResults compare={compare} direction={direction} />}

          {!compare && results && (
            <>
              <div className="flex items-baseline justify-between mb-14 flex-wrap gap-8">
                <h2 className="font-display text-[26px] text-nucleus-blue m-0">
                  {displayedMatches.length}{" "}
                  {filtersActive ? `of ${results.matches.length} ` : ""}ranked matches
                </h2>
                <div className="flex items-center gap-10">
                  <span className="tiny-caps">Source</span>
                  <span className="font-mono text-[11px] py-3 px-8 rounded-full bg-gold-faint text-[#8a5e1f]">
                    LIVE BACKEND
                  </span>
                </div>
              </div>

              {displayedMatches.length === 0 && (
                <div className="card p-24 text-graphite-muted text-[13.5px]">
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
  const isCopper = tone === "copper";
  return (
    <button
      onClick={onClick}
      className={`py-5 px-10 rounded-full text-[11.5px] font-medium border ${
        on
          ? isCopper
            ? "border-gold bg-gold-faint text-[#8a5e1f]"
            : "border-nucleus-blue bg-blue-100 text-nucleus-blue"
          : "border-pearl-300 bg-white text-graphite"
      }`}
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
      className={`card fade-in p-20 mb-12 ${blocked ? "opacity-66 border-pearl-300" : "border-pearl-200"}`}
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-18 items-start">
        <div className="flex flex-col items-center gap-6">
          <span className="font-mono text-[11px] text-graphite-light">
            #{String(index).padStart(2, "0")}
          </span>
          <ScoreArc score={match.score} />
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-10 flex-wrap">
            <span
              className={`font-display text-[22px] font-medium ${
                isStartup ? "text-nucleus-blue" : "text-graphite"
              }`}
            >
              {target.name}
            </span>
            <span className="text-[12px] text-graphite-muted">
              ·{" "}
              {isStartup
                ? `${SECTOR_LABEL[(target as Startup).sector]} · ${STAGE_LABEL[(target as Startup).stage]} · ${target.location_city}`
                : `${ROLE_CATEGORY_LABEL[(target as Person).role_category]} · ${(target as Person).headline}`}
            </span>
          </div>
          {!isStartup && (
            <div className="text-[12px] text-graphite-muted mt-2">
              {target.location_city} · {(target as Person).years_experience}y
            </div>
          )}
          {isStartup && (
            <div className="text-[13.5px] text-graphite mt-6">
              {(target as Startup).one_liner}
            </div>
          )}

          {match.reasons.length > 0 && (
            <ul className="mt-12 mb-6 pl-0 list-none flex flex-col gap-5">
              {match.reasons.slice(0, expanded ? 8 : 3).map((r, i) => (
                <li
                  key={i}
                  className="text-[13px] text-graphite flex gap-8"
                >
                  <span className="text-gold font-semibold">+</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {match.blockers.length > 0 && (
            <ul className="mt-6 mb-0 pl-0 list-none">
              {match.blockers.map((b, i) => (
                <li
                  key={i}
                  className="text-[13px] text-[#8a3a3a] flex gap-8"
                >
                  <span className="font-semibold">✕</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-240 flex flex-col gap-10">
          {expanded && <DimensionBars dims={match.dimension_scores} />}
          <div className="flex gap-6 justify-end flex-wrap">
            <button
              onClick={onToggle}
              className="btn btn-ghost py-6 px-12 text-[12px]"
            >
              {expanded ? "Less" : "Breakdown"}
            </button>
            {!blocked && (
              <button className="btn btn-primary py-6 px-12 text-[12px]">
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
      <h2 className="font-display text-[26px] text-nucleus-blue mt-0 mb-6">
        Side-by-side
      </h2>
      <p className="text-graphite-muted text-[13.5px] mt-0 mb-18">
        Same query. Every registered matcher. Compare top picks across rule-based, embedding,
        and agentic providers.
      </p>
      <div
        className="grid gap-14"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, matchers.length)}, 1fr)`,
        }}
      >
        {matchers.map((m) => (
          <div key={m} className="card p-14">
            <div className="flex items-baseline justify-between mb-10">
              <span className="font-display text-[15px] text-nucleus-blue">
                {m}
              </span>
              <span className="font-mono text-[10px] text-graphite-light">
                top {compare.by_matcher[m]?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col gap-8">
              {(compare.by_matcher[m] ?? []).slice(0, 6).map((mm, i) => {
                const t = isStartup ? mm.startup : mm.person;
                if (!t) return null;
                return (
                  <div
                    key={`${m}-${i}`}
                    className="grid grid-cols-[24px_1fr_auto] gap-8 items-center py-8 px-10 bg-pearl rounded-[6px]"
                  >
                    <span className="font-mono text-[10.5px] text-graphite-light">
                      #{i + 1}
                    </span>
                    <span className="text-[12.5px] font-medium text-graphite overflow-hidden text-ellipsis whitespace-nowrap">
                      {t.name}
                    </span>
                    <span
                      className={`font-mono text-[11px] ${mm.score >= 0.7 ? "text-gold" : "text-graphite-muted"}`}
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
    <div className="flex flex-col gap-12">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="card p-20 grid grid-cols-[72px_1fr_240px] gap-18"
        >
          <div className="shimmer h-72 w-72 rounded-full" />
          <div className="flex flex-col gap-10">
            <div className="shimmer h-18 w-[60%]" />
            <div className="shimmer h-12 w-[82%]" />
            <div className="shimmer h-12 w-[40%]" />
          </div>
          <div className="shimmer h-60 w-full" />
        </div>
      ))}
    </div>
  );
}
