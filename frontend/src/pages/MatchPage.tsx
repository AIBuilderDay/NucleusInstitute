import { useEffect, useMemo, useState } from "react";
import type {
  Availability,
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
  AVAILABILITIES,
  AVAILABILITY_LABEL,
  NETWORK_LABEL,
  NETWORKS,
  ROLE_CATEGORIES,
  ROLE_CATEGORY_LABEL,
  SECTORS,
  SECTOR_LABEL,
  STAGES,
  STAGE_LABEL,
} from "../labels";
import { DimensionBars, Field, ScoreArc, selectClass } from "../components/ui";

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

type SearchMode =
  | "startups"
  | "talent"
  | "mentors"
  | "investors"
  | "advisors"
  | "services"
  | "board"
  | "university";

const SEARCH_MODES: { id: SearchMode; label: string; dir: Direction; roles: RoleCategory[]; picker: "person" | "startup"; browse?: boolean }[] = [
  { id: "startups", label: "Startups", dir: "person_to_startups", roles: [], picker: "person" },
  { id: "talent", label: "Talent", dir: "startup_to_people", roles: ["executive", "operator"], picker: "startup" },
  { id: "mentors", label: "Mentors", dir: "startup_to_people", roles: ["mentor"], picker: "startup" },
  { id: "investors", label: "Investors", dir: "startup_to_people", roles: ["investor"], picker: "startup" },
  { id: "advisors", label: "Advisors", dir: "startup_to_people", roles: ["advisor"], picker: "startup" },
  { id: "services", label: "Services", dir: "startup_to_people", roles: ["service_provider"], picker: "startup" },
  { id: "board", label: "Board", dir: "startup_to_people", roles: ["board_member"], picker: "startup" },
  { id: "university", label: "University", dir: "person_to_startups", roles: ["university"], picker: "person", browse: true },
];

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
  const [searchMode, setSearchMode] = useState<SearchMode>(
    initialStartup ? "talent" : "startups",
  );
  const modeConfig = SEARCH_MODES.find((m) => m.id === searchMode)!;
  const direction: Direction = modeConfig.dir;
  const modeRoles = modeConfig.roles;
  const picker = modeConfig.picker;
  const isBrowse = !!modeConfig.browse;

  const [personId, setPersonId] = useState<string>(
    initialPerson?.id ?? currentUser.id ?? people[0]?.id ?? "",
  );
  const [startupId, setStartupId] = useState<string>(
    initialStartup?.id ?? startups[0]?.id ?? "",
  );

  const [sectorFilter, setSectorFilter] = useState<Sector[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage[]>([]);
  const [intentFilter, setIntentFilter] = useState<Intent[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleCategory[]>([]);
  const [networkFilter, setNetworkFilter] = useState<Network[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<Availability[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [universityFilter, setUniversityFilter] = useState<string>("");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 5;

  useEffect(() => {
    if (initialPerson) {
      setSearchMode("startups");
      setPersonId(initialPerson.id);
    }
    if (initialStartup) {
      setSearchMode("talent");
      setStartupId(initialStartup.id);
    }
  }, [initialPerson, initialStartup]);

  useEffect(() => {
    if (isBrowse) {
      const browseMatches: MatchResult[] = people
        .filter((p) => modeRoles.length === 0 || modeRoles.includes(p.role_category))
        .map((p) => ({
          talent_id: p.id,
          startup_id: "",
          score: 0,
          passed_hard_filters: true,
          reasons: [p.headline],
          blockers: [],
          dimension_scores: {},
          matcher: "browse",
          confidence: null,
          agent_notes: null,
          agent_raw_response: null,
          person: p,
          startup: undefined,
        }));
      setResults({ matches: browseMatches } as MatchResponse);
      setError(null);
      setLoading(false);
      return;
    }

    let dead = false;
    void (async () => {
      if (!personId && !startupId) return;
      setLoading(true);
      setError(null);
      try {
        const r =
          direction === "person_to_startups"
            ? await api.matchPerson(personId)
            : await api.matchStartup(startupId, {
                roles: modeRoles.length ? modeRoles : undefined,
              });
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
  }, [direction, isBrowse, searchMode, personId, startupId, people, startups]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) if (p.location_city) set.add(p.location_city);
    for (const s of startups) if (s.location_city) set.add(s.location_city);
    return [...set].sort();
  }, [people, startups]);

  const universities = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      for (const u of p.university_affiliations ?? []) set.add(u);
    }
    return [...set].sort();
  }, [people]);

  // Apply client-side filters to the already-fetched matches. Backend hard
  // filters already stripped role-category / availability / comp / location
  // mismatches; these filters narrow the survivors by *intent* and *category*.
  useEffect(() => setPage(0), [results, searchMode, sectorFilter, stageFilter, intentFilter, roleFilter, networkFilter, availabilityFilter, locationFilter, universityFilter, connectedOnly]);

  const displayedMatches = useMemo<MatchResult[]>(() => {
    if (!results) return [];
    return results.matches.filter((m) => {
      if (isBrowse) {
        const p = m.person;
        if (!p) return false;
        if (connectedOnly && !connectedPersonIds.has(p.id)) return false;
        if (sectorFilter.length && !p.sectors_of_interest.some((s) => sectorFilter.includes(s)))
          return false;
        if (locationFilter.length && !locationFilter.includes(p.location_city))
          return false;
        if (universityFilter && !(p.university_affiliations ?? []).includes(universityFilter))
          return false;
        return true;
      }
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
        if (availabilityFilter.length) {
          if (!s.availability_open_to.some((a) => availabilityFilter.includes(a))) return false;
        }
        if (locationFilter.length && !locationFilter.includes(s.location_city)) return false;
      } else {
        const p = m.person;
        if (!p) return false;
        if (connectedOnly && !connectedPersonIds.has(p.id)) return false;
        if (modeRoles.length && !modeRoles.includes(p.role_category)) return false;
        if (roleFilter.length && !roleFilter.includes(p.role_category)) return false;
        if (networkFilter.length && !networkFilter.includes(p.primary_network)) return false;
        if (sectorFilter.length && !p.sectors_of_interest.some((s) => sectorFilter.includes(s)))
          return false;
        if (stageFilter.length && !p.stage_preference.some((s) => stageFilter.includes(s)))
          return false;
        if (availabilityFilter.length && !availabilityFilter.includes(p.availability))
          return false;
        if (locationFilter.length && !locationFilter.includes(p.location_city))
          return false;
      }
      return true;
    });
  }, [results, direction, isBrowse, searchMode, sectorFilter, stageFilter, intentFilter, roleFilter, networkFilter, availabilityFilter, locationFilter, universityFilter, connectedOnly, connectedPersonIds, connectedStartupIds]);

  function toggle<V>(arr: V[], set: (v: V[]) => void, val: V) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const isPersonDir = picker === "person";
  const filtersActive =
    sectorFilter.length +
      stageFilter.length +
      intentFilter.length +
      roleFilter.length +
      networkFilter.length +
      availabilityFilter.length +
      locationFilter.length >
      0 || !!universityFilter || connectedOnly;

  return (
    <div>
      <div className="max-w-[1440px] mx-auto pt-28 px-32 pb-64 grid grid-cols-[380px_1fr] gap-24">
        <aside className="card p-22 self-start sticky top-88">
          <div className="tiny-caps mb-12">Find Matches</div>

          <div className="flex flex-wrap bg-pearl-200 rounded-[8px] p-3 mb-18 gap-2">
            {SEARCH_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSearchMode(m.id)}
                className={`py-7 px-10 rounded-[6px] text-[12px] font-medium ${
                  searchMode === m.id
                    ? "bg-white text-nucleus-blue"
                    : "bg-transparent text-graphite-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {isBrowse ? (
            <Field label="University" hint="Filter by Utah university affiliation.">
              <select
                value={universityFilter}
                onChange={(e) => setUniversityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">All universities</option>
                {universities.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field
                label="I am…"
                hint={
                  isPersonDir
                    ? "The talent searching for startups."
                    : "Your role — used to frame matches."
                }
              >
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
              {!isPersonDir && (
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
            </>
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
          {isPersonDir && !isBrowse && (
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

          <Field
            label="Stage"
            hint={isPersonDir ? "Startup stage." : "Stage preference."}
          >
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

          <Field label="Availability" hint="Optional. Empty = all.">
            <div className="flex flex-wrap gap-6">
              {AVAILABILITIES.map((a) => (
                <ToggleChip
                  key={a}
                  on={availabilityFilter.includes(a)}
                  onClick={() => toggle(availabilityFilter, setAvailabilityFilter, a)}
                >
                  {AVAILABILITY_LABEL[a]}
                </ToggleChip>
              ))}
            </div>
          </Field>

          <Field label="Location" hint="Optional. Empty = all.">
            <div className="flex flex-wrap gap-6">
              {locations.map((loc) => (
                <ToggleChip
                  key={loc}
                  on={locationFilter.includes(loc)}
                  onClick={() => toggle(locationFilter, setLocationFilter, loc)}
                >
                  {loc}
                </ToggleChip>
              ))}
            </div>
          </Field>

          <div className="flex gap-8 mt-8">
            <button className="btn btn-primary flex-1">
              Find matches
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
                setAvailabilityFilter([]);
                setLocationFilter([]);
                setUniversityFilter("");
                setConnectedOnly(false);
              }}
            >
              Clear filters
            </button>
          )}

        </aside>

        <main>
          {error && (
            <div className="py-14 px-18 rounded-[8px] bg-[#fbe8e0] text-[#8a3a3a] text-[13px] mb-14">
              ⚠ Match request failed: {error}
            </div>
          )}

          {loading && !results && <ResultSkeleton />}

          {results && (
            <>
              <div className="flex items-baseline justify-between mb-14 flex-wrap gap-8">
                <h2 className="font-display text-[26px] text-nucleus-blue m-0">
                  {displayedMatches.length}{" "}
                  {filtersActive ? `of ${results.matches.length} ` : ""}
                  {isBrowse ? "people" : "ranked matches"}
                </h2>
                {!isBrowse && (
                  <div className="flex items-center gap-10">
                    <span className="tiny-caps">Source</span>
                    <span className="font-mono text-[11px] py-3 px-8 rounded-full bg-gold-faint text-[#8a5e1f]">
                      LIVE BACKEND
                    </span>
                  </div>
                )}
              </div>

              {displayedMatches.length === 0 && (
                <div className="card p-24 text-graphite-muted text-[13.5px]">
                  No matches passed the active filters. Try clearing one or two of them.
                </div>
              )}

              {(() => {
                const totalPages = Math.max(1, Math.ceil(displayedMatches.length / pageSize));
                const safePage = Math.min(page, totalPages - 1);
                const start = safePage * pageSize;
                const pageMatches = displayedMatches.slice(start, start + pageSize);

                return (
                  <>
                    {pageMatches.map((m, i) => (
                      <MatchCard
                        key={`${m.talent_id}-${m.startup_id}-${i}`}
                        match={m}
                        index={start + i + 1}
                        direction={direction}
                        expanded={expanded === start + i}
                        onToggle={() => setExpanded(expanded === start + i ? null : start + i)}
                        browse={isBrowse}
                      />
                    ))}

                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-6 mt-20">
                        <button
                          disabled={safePage === 0}
                          onClick={() => { setPage(safePage - 1); setExpanded(null); }}
                          className="btn btn-ghost py-6 px-12 text-[12px] disabled:opacity-40"
                        >
                          ← Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, p) => (
                          <button
                            key={p}
                            onClick={() => { setPage(p); setExpanded(null); }}
                            className={`py-6 px-10 rounded-[6px] text-[12px] font-medium ${
                              p === safePage
                                ? "bg-nucleus-blue text-white"
                                : "btn btn-ghost"
                            }`}
                          >
                            {p + 1}
                          </button>
                        ))}
                        <button
                          disabled={safePage >= totalPages - 1}
                          onClick={() => { setPage(safePage + 1); setExpanded(null); }}
                          className="btn btn-ghost py-6 px-12 text-[12px] disabled:opacity-40"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
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
  browse?: boolean;
}

function MatchCard({ match, index, direction, expanded, onToggle, browse }: MatchCardProps) {
  const isStartup = !browse && direction === "person_to_startups";
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
          {!browse && <ScoreArc score={match.score} />}
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

          {(match.reasons.length > 0 || match.agent_notes) && (
            <div className="mt-12 mb-6 rounded-[8px] bg-[#f7f5ef] border border-[#e8e2d0] px-14 py-10">
              <div className="text-[11px] font-semibold tracking-wide uppercase text-[#8a5e1f] mb-6">
                Why this match
              </div>
              {match.agent_notes && (
                <p className="text-[13.5px] text-graphite mb-8 leading-relaxed m-0">
                  {match.agent_notes}
                </p>
              )}
              <ul className="pl-0 list-none flex flex-col gap-4 m-0">
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
              {match.confidence != null && (
                <div className="mt-8 text-[11px] text-graphite-muted">
                  AI confidence: {Math.round(match.confidence * 100)}%
                </div>
              )}
            </div>
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
