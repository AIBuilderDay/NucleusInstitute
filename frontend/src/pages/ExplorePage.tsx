import { useMemo, useState } from "react";
import type {
  Network,
  Person,
  RoleCategory,
  Sector,
  Stage,
  Startup,
} from "../types";
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
import { Avatar, Pill, Sidesheet } from "../components/ui";
import { SwipeDeck } from "../components/SwipeDeck";
import { FilterRow, PersonDetailBody, StartupDetailBody } from "./shared";

interface ExplorePageProps {
  people: Person[];
  startups: Startup[];
  onConnectPerson: (p: Person) => void;
  onConnectStartup: (s: Startup) => void;
  onPassPerson: (p: Person) => void;
  onPassStartup: (s: Startup) => void;
  connectedPersonIds: Set<string>;
  connectedStartupIds: Set<string>;
  passedPersonIds: Set<string>;
  passedStartupIds: Set<string>;
}

type Tab = "people" | "startups";
type Step = "filter" | "swipe" | "results";
type Detail =
  | { kind: "person"; item: Person }
  | { kind: "startup"; item: Startup }
  | null;

export function ExplorePage({
  people,
  startups,
  onConnectPerson,
  onConnectStartup,
  onPassPerson,
  onPassStartup,
  connectedPersonIds,
  connectedStartupIds,
  passedPersonIds,
  passedStartupIds,
}: ExplorePageProps) {
  const [tab, setTab] = useState<Tab>("people");
  const [step, setStep] = useState<Step>("filter");
  const [sectorFilter, setSectorFilter] = useState<Sector[]>([]);
  const [networkFilter, setNetworkFilter] = useState<Network[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleCategory[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage[]>([]);
  const [openToFilter, setOpenToFilter] = useState<RoleCategory[]>([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Detail>(null);
  const [swipedPeople, setSwipedPeople] = useState<Person[]>([]);
  const [swipedStartups, setSwipedStartups] = useState<Startup[]>([]);

  const filteredPeople = useMemo(() => {
    const q = query.toLowerCase();
    return people.filter((p) => {
      if (sectorFilter.length && !p.sectors_of_interest.some((s) => sectorFilter.includes(s)))
        return false;
      if (networkFilter.length && !networkFilter.includes(p.primary_network)) return false;
      if (roleFilter.length && !roleFilter.includes(p.role_category)) return false;
      if (
        q &&
        !(p.name + " " + p.headline + " " + (p.skills ?? []).join(" ")).toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [people, sectorFilter, networkFilter, roleFilter, query]);

  const filteredStartups = useMemo(() => {
    const q = query.toLowerCase();
    return startups.filter((s) => {
      if (
        sectorFilter.length &&
        !sectorFilter.includes(s.sector) &&
        !(s.sectors_secondary ?? []).some((x) => sectorFilter.includes(x))
      )
        return false;
      if (stageFilter.length && !stageFilter.includes(s.stage)) return false;
      if (
        openToFilter.length &&
        !s.role_categories_open_to.some((r) => openToFilter.includes(r))
      )
        return false;
      if (q && !(s.name + " " + s.one_liner).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [startups, sectorFilter, stageFilter, openToFilter, query]);

  function toggle<V>(arr: V[], set: (v: V[]) => void, val: V) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const resultCount = tab === "people" ? filteredPeople.length : filteredStartups.length;

  const handleStartBrowsing = () => {
    setSwipedPeople([]);
    setSwipedStartups([]);
    setStep("swipe");
  };

  const handleConnectPerson = (p: Person) => {
    setSwipedPeople((prev) => [...prev, p]);
    onConnectPerson(p);
  };

  const handleConnectStartup = (s: Startup) => {
    setSwipedStartups((prev) => [...prev, s]);
    onConnectStartup(s);
  };

  const handleBackToFilters = () => {
    setSwipedPeople([]);
    setSwipedStartups([]);
    setStep("filter");
  };

  const handleRemovePerson = (id: string) => {
    setSwipedPeople((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRemoveStartup = (id: string) => {
    setSwipedStartups((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Step 1: Filter ──────────────────────────────────────────────────────────
  if (step === "filter") {
    return (
      <div className="flex flex-col flex-1">
        <div className="max-w-[860px] mx-auto pt-48 px-32 pb-32 flex flex-col flex-1 w-full">
          <div className="text-center mb-40">
            <h1 className="font-display text-[38px] font-medium text-nucleus-blue tracking-[-0.015em] mb-8">
              Discover Connections
            </h1>
            <p className="text-[15px] text-graphite-muted max-w-[480px] mx-auto leading-[1.5]">
              Set your filters, then swipe through profiles to find your next connection.
            </p>
          </div>

          <div className="flex justify-center mb-32">
            <div className="flex bg-pearl-200 rounded-[8px] p-3">
              {(["people", "startups"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`py-10 px-24 rounded-[6px] text-[14px] font-medium transition-all duration-[0.12s] ${
                    tab === t
                      ? "bg-white text-nucleus-blue shadow-[0_1px_2px_rgba(15,44,79,0.08)]"
                      : "bg-transparent text-graphite-muted"
                  }`}
                >
                  {t === "people" ? "People" : "Startups"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-pearl-300 rounded-[16px] p-28 mb-28">
            <div className="relative mb-24">
              <input
                type="text"
                placeholder={`Search ${tab}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full py-12 pr-14 pl-40 rounded-[10px] border border-pearl-300 bg-pearl text-[14px] text-graphite"
              />
              <span className="absolute left-14 top-12 text-graphite-light text-[16px]">
                ⌕
              </span>
            </div>

            <div className="grid gap-14">
              <FilterRow<Sector>
                label="Sector"
                options={SECTORS.map((s) => [s, SECTOR_LABEL[s]] as const)}
                selected={sectorFilter}
                onToggle={(v) => toggle(sectorFilter, setSectorFilter, v)}
              />
              {tab === "people" && (
                <>
                  <FilterRow<RoleCategory>
                    label="Role"
                    options={ROLE_CATEGORIES.map((r) => [r, ROLE_CATEGORY_LABEL[r]] as const)}
                    selected={roleFilter}
                    onToggle={(v) => toggle(roleFilter, setRoleFilter, v)}
                  />
                  <FilterRow<Network>
                    label="Network"
                    options={NETWORKS.map((n) => [n, NETWORK_LABEL[n]] as const)}
                    selected={networkFilter}
                    onToggle={(v) => toggle(networkFilter, setNetworkFilter, v)}
                  />
                </>
              )}
              {tab === "startups" && (
                <>
                  <FilterRow<Stage>
                    label="Stage"
                    options={STAGES.map((s) => [s, STAGE_LABEL[s]] as const)}
                    selected={stageFilter}
                    onToggle={(v) => toggle(stageFilter, setStageFilter, v)}
                  />
                  <FilterRow<RoleCategory>
                    label="Open to"
                    options={ROLE_CATEGORIES.map((r) => [r, ROLE_CATEGORY_LABEL[r]] as const)}
                    selected={openToFilter}
                    onToggle={(v) => toggle(openToFilter, setOpenToFilter, v)}
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-between mt-24 pt-20 border-t border-pearl-200">
              <button
                className="btn btn-ghost text-[13px]"
                onClick={() => {
                  setSectorFilter([]);
                  setNetworkFilter([]);
                  setRoleFilter([]);
                  setStageFilter([]);
                  setOpenToFilter([]);
                  setQuery("");
                }}
              >
                Clear all filters
              </button>
              <div className="text-[13px] text-graphite-muted">
                {resultCount} {tab === "people" ? "people" : "startups"} match
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              className="btn btn-primary py-14 px-40 text-[16px] font-medium rounded-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={resultCount === 0}
              onClick={handleStartBrowsing}
            >
              Start Browsing
              {resultCount > 0 && (
                <span className="ml-8 py-2 px-10 bg-[rgba(255,255,255,0.2)] rounded-full text-[13px]">
                  {resultCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Swipe ──────────────────────────────────────────────────────────
  if (step === "swipe") {
    const currentCount = tab === "people" ? swipedPeople.length : swipedStartups.length;

    return (
      <div className="flex flex-col flex-1 h-full overflow-x-hidden">
        <div className="max-w-[1440px] mx-auto pt-24 px-32 pb-16 flex flex-col flex-1 w-full">
          <div className="flex items-center justify-between mb-16">
            <button className="btn btn-ghost text-[13px]" onClick={handleBackToFilters}>
              ← Back to filters
            </button>
            <div className="flex items-center gap-12">
              {currentCount > 0 && (
                <span className="text-[13px] text-sage font-medium">
                  {currentCount} connection{currentCount !== 1 ? "s" : ""} selected
                </span>
              )}
              <button
                className="btn btn-primary py-8 px-20 text-[13px]"
                onClick={() => setStep("results")}
                disabled={currentCount === 0}
              >
                Review selections →
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            {tab === "people" ? (
              <SwipeDeck
                items={filteredPeople}
                kind="person"
                onView={(p) => setDetail({ kind: "person", item: p as Person })}
                onConnect={(p) => handleConnectPerson(p as Person)}
                onPass={(p) => onPassPerson(p as Person)}
                connectedIds={connectedPersonIds}
                passedIds={passedPersonIds}
                emptyText="You've seen everyone! Review your selections."
                onComplete={() => setStep("results")}
              />
            ) : (
              <SwipeDeck
                items={filteredStartups}
                kind="startup"
                onView={(s) => setDetail({ kind: "startup", item: s as Startup })}
                onConnect={(s) => handleConnectStartup(s as Startup)}
                onPass={(s) => onPassStartup(s as Startup)}
                connectedIds={connectedStartupIds}
                passedIds={passedStartupIds}
                emptyText="You've seen everyone! Review your selections."
                onComplete={() => setStep("results")}
              />
            )}
          </div>
        </div>

        <Sidesheet
          open={!!detail && detail.kind === "person"}
          onClose={() => setDetail(null)}
          title={detail?.kind === "person" ? detail.item.name : ""}
          subtitle={
            detail?.kind === "person"
              ? `${ROLE_CATEGORY_LABEL[detail.item.role_category]} · ${NETWORK_LABEL[detail.item.primary_network]}`
              : ""
          }
          accent="blue"
        >
          {detail?.kind === "person" && (
            <PersonDetailBody
              p={detail.item}
              onMatch={() => {
                onConnectPerson(detail.item);
                setDetail(null);
              }}
            />
          )}
        </Sidesheet>
        <Sidesheet
          open={!!detail && detail.kind === "startup"}
          onClose={() => setDetail(null)}
          title={detail?.kind === "startup" ? detail.item.name : ""}
          subtitle="Startup · seeking matches"
          accent="copper"
        >
          {detail?.kind === "startup" && (
            <StartupDetailBody
              s={detail.item}
              onMatch={() => {
                onConnectStartup(detail.item);
                setDetail(null);
              }}
            />
          )}
        </Sidesheet>
      </div>
    );
  }

  // ── Step 3: Results ──────────────────────────────────────────────────────────
  const connections = tab === "people" ? swipedPeople : swipedStartups;
  const hasConnections = connections.length > 0;

  return (
    <div className="flex flex-col flex-1">
      <div className="max-w-[780px] mx-auto pt-48 px-32 pb-32 flex flex-col flex-1 w-full">
        <div className="text-center mb-40">
          <div className="w-72 h-72 rounded-full bg-red flex items-center justify-center mx-auto mb-20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="font-display text-[34px] font-medium text-nucleus-blue tracking-[-0.015em] mb-8">
            {hasConnections ? "Your Connections" : "No Connections Yet"}
          </h1>
          <p className="text-[15px] text-graphite-muted max-w-[420px] mx-auto leading-[1.5]">
            {hasConnections
              ? `You selected ${connections.length} ${tab === "people" ? "people" : "startups"} to connect with.`
              : "You didn't select anyone this round. Try adjusting your filters."}
          </p>
        </div>

        {hasConnections && (
          <div className="grid gap-12 mb-32">
            {tab === "people"
              ? swipedPeople.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border border-pearl-300 rounded-[14px] p-20 flex items-center gap-16 group"
                  >
                    <Avatar name={p.name} size={50} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-8 flex-wrap">
                        <span className="font-display font-medium text-[17px] text-graphite">
                          {p.name}
                        </span>
                        <span className="text-[12px] text-graphite-muted">
                          {p.location_city} · {p.years_experience}y
                        </span>
                      </div>
                      <div className="text-[13px] text-graphite-muted mt-2 truncate">
                        {p.headline}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-6">
                        {p.sectors_of_interest.slice(0, 2).map((s) => (
                          <Pill key={s} tone="blue">{SECTOR_LABEL[s]}</Pill>
                        ))}
                        <Pill>{NETWORK_LABEL[p.primary_network].replace(" Network", "")}</Pill>
                      </div>
                    </div>
                    <div className="flex gap-8 shrink-0">
                      <button
                        className="btn btn-ghost text-[12px] py-6 px-12 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemovePerson(p.id)}
                      >
                        Remove
                      </button>
                      <button
                        className="btn btn-ghost text-[12px] py-6 px-12"
                        onClick={() => setDetail({ kind: "person", item: p })}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))
              : swipedStartups.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border border-pearl-300 rounded-[14px] p-20 flex items-center gap-16 group"
                  >
                    <div
                      className="w-50 h-50 rounded-[12px] shrink-0 flex items-center justify-center font-display text-[22px] font-medium bg-nucleus-blue text-blue-50"
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-8 flex-wrap">
                        <span className="font-display font-medium text-[17px] text-nucleus-blue">
                          {s.name}
                        </span>
                        <span className="text-[12px] text-graphite-muted">
                          {s.location_city}
                        </span>
                      </div>
                      <div className="text-[13px] text-graphite-muted mt-2 truncate">
                        {s.one_liner}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-6">
                        <Pill tone="blue">{SECTOR_LABEL[s.sector]}</Pill>
                        <Pill>{STAGE_LABEL[s.stage]}</Pill>
                      </div>
                    </div>
                    <div className="flex gap-8 shrink-0">
                      <button
                        className="btn btn-ghost text-[12px] py-6 px-12 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveStartup(s.id)}
                      >
                        Remove
                      </button>
                      <button
                        className="btn btn-ghost text-[12px] py-6 px-12"
                        onClick={() => setDetail({ kind: "startup", item: s })}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        )}

        <div className="flex justify-center gap-12">
          <button className="btn btn-ghost" onClick={handleBackToFilters}>
            ← New search
          </button>
          {hasConnections && (
            <button
              className="btn btn-primary py-12 px-32 text-[15px]"
              onClick={handleStartBrowsing}
            >
              Explore more
            </button>
          )}
        </div>
      </div>

      <Sidesheet
        open={!!detail && detail.kind === "person"}
        onClose={() => setDetail(null)}
        title={detail?.kind === "person" ? detail.item.name : ""}
        subtitle={
          detail?.kind === "person"
            ? `${ROLE_CATEGORY_LABEL[detail.item.role_category]} · ${NETWORK_LABEL[detail.item.primary_network]}`
            : ""
        }
        accent="blue"
      >
        {detail?.kind === "person" && (
          <PersonDetailBody
            p={detail.item}
            onMatch={() => {
              onConnectPerson(detail.item);
              setDetail(null);
            }}
          />
        )}
      </Sidesheet>
      <Sidesheet
        open={!!detail && detail.kind === "startup"}
        onClose={() => setDetail(null)}
        title={detail?.kind === "startup" ? detail.item.name : ""}
        subtitle="Startup · seeking matches"
        accent="copper"
      >
        {detail?.kind === "startup" && (
          <StartupDetailBody
            s={detail.item}
            onMatch={() => {
              onConnectStartup(detail.item);
              setDetail(null);
            }}
          />
        )}
      </Sidesheet>
    </div>
  );
}
