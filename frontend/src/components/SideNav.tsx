import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "../routeHero";
import { IUMonogram, ExportModal } from "./ui";
import type { Person, Startup } from "../types";
import { SECTOR_LABEL, STAGE_LABEL, ROLE_CATEGORY_LABEL } from "../labels";
import { exportCsv, exportPdf } from "../export";

export interface OidcUserBadge {
  name: string;
  email?: string;
  picture: string;
  provider: "linkedin" | "google";
}

interface SideNavProps {
  route: Route;
  setRoute: (r: Route) => void;
  currentUser: Person | null;
  people: Person[];
  startups: Startup[];
  onSelectPerson: (p: Person) => void;
  onSelectStartup: (s: Startup) => void;
  minimal?: boolean;
  oidcUser?: OidcUserBadge | null;
  onSignOut?: () => void;
}

type SearchResult =
  | { kind: "person"; item: Person }
  | { kind: "startup"; item: Startup }
  | { kind: "category"; label: string; type: string };


const NAV_ITEMS: ReadonlyArray<{ id: Route; label: string; icon: "search" | "filter" | "star" | "globe" | "topology" }> = [

  { id: "explore", label: "Explore", icon: "search" },
  { id: "match", label: "Match", icon: "filter" },
  { id: "ecosystem", label: "Ecosystem", icon: "globe" },
  { id: "profile", label: "Profile", icon: "star" },
  { id: "topology", label: "Topology", icon: "topology" },
];

function NavIcon({ type, active }: { type: string; active?: boolean }) {
  const color = active ? "var(--nucleus-blue)" : "var(--graphite-muted)";
  if (type === "search")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="6" cy="6" r="4" stroke={color} strokeWidth="1.5" />
        <path d="M9.5 9.5l2.5 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  if (type === "filter")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 3h10M4 7h6M6 11h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  if (type === "globe")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" />
        <path d="M2 7h10M7 2c1.8 2.2 1.8 7.8 0 10M7 2c-1.8 2.2-1.8 7.8 0 10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  if (type === "gear")
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
          stroke={color} strokeWidth="1.8"
        />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    );
  if (type === "topology")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M1 12l3-5 2.5 3L9 4l4 8"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (type === "star")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 1.5l1.7 3.6 3.8.5-2.8 2.7.7 3.9L7 10.4 3.6 12.2l.7-3.9L1.5 5.6l3.8-.5L7 1.5z"
          stroke={color} strokeWidth="1.2" fill="none" strokeLinejoin="round"
        />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke={color} strokeWidth="1.4" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.75 2.75l1.06 1.06M10.19 10.19l1.06 1.06M11.25 2.75l-1.06 1.06M3.81 10.19l-1.06 1.06" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SideNavItem({
  active,
  children,
  onClick,
  icon,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`flex items-center gap-12 py-9 px-12 text-[14px] border-0 rounded-[6px] cursor-pointer text-left transition-all duration-150 w-full ${
        active
          ? "text-nucleus-blue bg-blue-50 font-medium"
          : hover
            ? "text-graphite bg-pearl font-normal"
            : "text-graphite-muted bg-transparent font-normal"
      }`}
    >
      <span className="grid place-items-center">{icon}</span>
      {children}
    </button>
  );
}

export function SideNav({
  route,
  setRoute,
  currentUser,
  people,
  startups,
  onSelectPerson,
  onSelectStartup,
  minimal = false,
  oidcUser = null,
  onSignOut,
}: SideNavProps) {
  const initials = currentUser
    ? currentUser.name
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  const [exportOpen, setExportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const cats: Array<{ label: string; type: string }> = [];
    for (const [, label] of Object.entries(SECTOR_LABEL)) {
      cats.push({ label, type: "Sector" });
    }
    for (const [, label] of Object.entries(STAGE_LABEL)) {
      cats.push({ label, type: "Stage" });
    }
    for (const [, label] of Object.entries(ROLE_CATEGORY_LABEL)) {
      cats.push({ label, type: "Role" });
    }
    return cats;
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    for (const p of people) {
      const haystack = [p.name, p.headline, p.role_category, ...p.skills, p.location_city].join(" ").toLowerCase();
      if (haystack.includes(q)) out.push({ kind: "person", item: p });
    }
    for (const s of startups) {
      const haystack = [s.name, s.one_liner, s.sector, ...(s.sectors_secondary ?? []), s.location_city].join(" ").toLowerCase();
      if (haystack.includes(q)) out.push({ kind: "startup", item: s });
    }
    for (const c of categories) {
      if (c.label.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)) {
        out.push({ kind: "category", label: c.label, type: c.type });
      }
    }
    return out.slice(0, 12);
  }, [query, people, startups, categories]);

  useEffect(() => {
    setActiveIdx(-1);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function selectResult(r: SearchResult) {
    setQuery("");
    setSearchOpen(false);
    if (r.kind === "person") onSelectPerson(r.item);
    else if (r.kind === "startup") onSelectStartup(r.item);
    else setRoute("explore");
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault();
      selectResult(results[activeIdx]);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <aside className="sidenav">
      {/* Logo */}
      <button
        onClick={() => setRoute("landing")}
        className="pt-22 px-22 pb-18 border-0 border-b border-solid border-pearl-200 bg-none cursor-pointer w-full text-left"
      >
        <div className="flex items-center gap-10">
          <IUMonogram size={28} />
          <div
            className="font-display font-medium text-[18px] text-graphite tracking-[-0.2px]"
          >
            Nucleus
          </div>
          <div
            className="font-mono text-[9px] uppercase tracking-[1.5px] text-graphite-muted py-3 px-6 border border-solid border-pearl-300 rounded-[4px]"
          >
            Institute
          </div>
        </div>
      </button>

      {/* Search */}
      {!minimal && (
        <div ref={searchRef} className="pt-16 px-16 pb-8 relative">
          <div
            className="flex items-center gap-8 px-12 bg-pearl rounded-[6px] border border-solid border-transparent"
          >
            <NavIcon type="search" />
            <input
              ref={inputRef}
              className="!border-none !shadow-none !ring-0 !outline-none focus:!border-none focus:!shadow-none focus:!ring-0 flex-1 py-8 bg-transparent text-[13px] text-graphite min-w-0"
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search..."
            />
            {!query && (
              <span
                className="font-mono text-[10px] text-graphite-light py-2 px-5 border border-solid border-pearl-300 rounded-[3px] shrink-0"
              >
                ⌘K
              </span>
            )}
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="bg-none border-0 cursor-pointer text-graphite-light text-[12px] p-2 leading-none"
              >
                ✕
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {searchOpen && query.trim() && (
            <div
              className="absolute left-16 right-16 top-full mt-4 bg-white border border-solid border-pearl-300 rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[340px] overflow-y-auto z-100"
            >
              {results.length === 0 && (
                <div className="py-16 px-14 text-[12px] text-graphite-light">
                  No results for "{query}"
                </div>
              )}
              {results.length > 0 && (
                <div className="py-6">
                  {results.map((r, i) => (
                    <SearchResultRow
                      key={r.kind === "person" ? `p-${r.item.id}` : r.kind === "startup" ? `s-${r.item.id}` : `c-${r.label}`}
                      result={r}
                      active={i === activeIdx}
                      onClick={() => selectResult(r)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      {!minimal && (
        <nav className="py-8 px-12 flex flex-col gap-2">
          <div
            className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light pt-10 px-12 pb-6"
          >
            Workspace
          </div>
          {NAV_ITEMS.map((item) => (
            <SideNavItem
              key={item.id}
              active={route === item.id}
              onClick={() => setRoute(item.id)}
              icon={<NavIcon type={item.icon} active={route === item.id} />}
            >
              {item.label}
            </SideNavItem>
          ))}
        </nav>
      )}

      <div className="flex-1" />

      {/* Footer */}
      {!minimal && (
        <div
          className="p-12 border-t border-solid border-pearl-200 flex flex-col gap-8"
        >
          <SideNavItem
            active={false}
            onClick={() => setExportOpen(true)}
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="var(--graphite-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 10v1.5a1 1 0 001 1h8a1 1 0 001-1V10" stroke="var(--graphite-muted)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          >
            Export
          </SideNavItem>
          <SideNavItem
            active={route === "settings"}
            onClick={() => setRoute("settings")}
            icon={<NavIcon type="gear" active={route === "settings"} />}
          >
            Settings
          </SideNavItem>
          <button
            onClick={() => setRoute("linkedin")}
            className="py-8 px-12 text-[12px] text-graphite-muted bg-transparent border-0 text-left cursor-pointer rounded-[6px]"
          >
            Join / Re-onboard
          </button>
          {oidcUser ? (
            <div className="flex items-center gap-10 py-8 px-12 rounded-[6px] bg-pearl">
              {oidcUser.picture ? (
                <img
                  src={oidcUser.picture}
                  alt={oidcUser.name}
                  className="w-32 h-32 rounded-full object-cover shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-graphite text-white grid place-items-center font-display font-medium text-[12px] shrink-0">
                  {oidcUser.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase() ?? "")
                    .join("")}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-graphite font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {oidcUser.name}
                </div>
                <div className="font-mono text-[10px] text-graphite-muted uppercase tracking-[1px]">
                  {oidcUser.provider}
                </div>
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="text-[10px] text-graphite-muted hover:text-graphite bg-transparent border-0 cursor-pointer p-0 shrink-0"
                  aria-label="Sign out"
                >
                  ✕
                </button>
              )}
            </div>
          ) : currentUser && (
            <div
              className="flex items-center gap-10 py-8 px-12 rounded-[6px] bg-pearl"
            >
              <div
                className="w-32 h-32 rounded-full bg-graphite text-white grid place-items-center font-display font-medium text-[12px] shrink-0"
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[12px] text-graphite font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {currentUser.name}
                </div>
                <div
                  className="font-mono text-[10px] text-graphite-muted uppercase tracking-[1px]"
                >
                  Verified
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onCsv={() => exportCsv(people, startups)}
        onPdf={() => exportPdf(people, startups)}
      />
    </aside>
  );
}

function SearchResultRow({
  result,
  active,
  onClick,
}: {
  result: SearchResult;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const highlight = active || hover;

  if (result.kind === "person") {
    const p = result.item;
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={rowClass(highlight)}
      >
        <div className={`${avatarClass} bg-nucleus-blue`}>
          {p.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className={nameClass}>{p.name}</div>
          <div className={subClass}>{p.headline}</div>
        </div>
        <span className={`font-mono ${badgeClass}`}>Person</span>
      </button>
    );
  }

  if (result.kind === "startup") {
    const s = result.item;
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={rowClass(highlight)}
      >
        <div className={`${avatarClass} bg-graphite`}>
          {s.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className={nameClass}>{s.name}</div>
          <div className={subClass}>{s.one_liner}</div>
        </div>
        <span className={`font-mono ${badgeClass}`}>Startup</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={rowClass(highlight)}
    >
      <div className={`${avatarClass} text-[10px] bg-graphite-muted`}>
        <NavIcon type="filter" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={nameClass}>{result.label}</div>
      </div>
      <span className={`font-mono ${badgeClass}`}>{result.type}</span>
    </button>
  );
}

const rowClass = (highlight: boolean) =>
  `flex items-center gap-10 w-full py-8 px-14 border-0 cursor-pointer text-left transition-colors duration-100 ${
    highlight ? "bg-pearl" : "bg-transparent"
  }`;

const avatarClass =
  "w-28 h-28 rounded-full text-white grid place-items-center font-display font-medium text-[11px] shrink-0";

const nameClass =
  "text-[12px] font-medium text-graphite whitespace-nowrap overflow-hidden text-ellipsis";

const subClass =
  "text-[11px] text-graphite-muted whitespace-nowrap overflow-hidden text-ellipsis mt-1";

const badgeClass =
  "text-[9px] text-graphite-light uppercase tracking-[1px] shrink-0";
