import { useEffect, useMemo, useState } from "react";
import type { EcosystemStartup, EcosystemView, Stage } from "./types";
import { loadEcosystemStartups } from "./data/loader";
import { MapViewTabs } from "./MapViewTabs";
import { MapFilters, type FilterState } from "./components/MapFilters";
import { StartupDetailPanel } from "./components/StartupDetailPanel";
import { MapView } from "./views/MapView";
import { ListView } from "./views/ListView";
import { useEcosystem } from "../EcosystemContext";

const EMPTY_FILTERS: FilterState = {
  sections: [],
  stages: [],
  employees: [],
  cities: [],
  query: "",
};

/**
 * UtahStartupMap — section component for the Ecosystem page.
 *
 * Self-contained: loads its CSV, owns its filter/view/selection state, renders
 * its own filter rail, view tabs, and detail sidesheet. Layout-agnostic — the
 * parent page can drop it anywhere.
 */
export function UtahStartupMap() {
  const [startups, setStartups] = useState<EcosystemStartup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<EcosystemView>("map");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { match } = useEcosystem();

  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const rows = await loadEcosystemStartups();
        if (!dead) setStartups(rows);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // — When a user match arrives from the InterestModal, seed the filters from
  // their inferred categories. We only push, never silently override an active
  // user filter (so they can still tweak after).
  useEffect(() => {
    if (!match) return;
    setFilters({
      sections: match.sectors,
      stages: match.stages.filter(isValidStage) as Stage[],
      employees: [],
      cities: match.city ? [match.city.toLowerCase()] : [],
      query: "",
    });
  }, [match]);

  const visible = useMemo(() => {
    const q = filters.query.toLowerCase().trim();
    return startups.filter((s) => {
      if (filters.sections.length && !filters.sections.includes(s.section)) return false;
      if (filters.stages.length && !filters.stages.includes(s.stage)) return false;
      if (filters.employees.length && !filters.employees.includes(s.employees))
        return false;
      if (filters.cities.length && !filters.cities.includes(s.city)) return false;
      if (q) {
        const hay = (s.name + " " + s.description + " " + s.section).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [startups, filters]);

  const filtered = visible.length !== startups.length;
  const selected = useMemo(
    () => (selectedId ? startups.find((s) => s.id === selectedId) ?? null : null),
    [selectedId, startups],
  );

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span className="tiny-caps">
          {filtered
            ? `${visible.length} of ${startups.length} startups`
            : `${startups.length} startups`}
        </span>
        <MapViewTabs view={view} setView={setView} />
      </div>

      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "#fbe8e0",
            color: "#8a3a3a",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="shimmer" style={{ height: 520 }} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          <MapFilters all={startups} filters={filters} setFilters={setFilters} />
          <div style={{ minWidth: 0 }}>
            {view === "map" ? (
              <MapView
                startups={visible}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <ListView startups={visible} onSelect={setSelectedId} />
            )}
          </div>
        </div>
      )}

      <StartupDetailPanel startup={selected} onClose={() => setSelectedId(null)} />
    </section>
  );
}

const VALID_STAGES: ReadonlyArray<Stage> = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c_plus",
  "growth",
  "public",
  "unknown",
];
function isValidStage(s: string): s is Stage {
  return (VALID_STAGES as readonly string[]).includes(s);
}
