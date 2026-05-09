import { useMemo } from "react";
import type { EcosystemStartup, EmployeeBucket, Stage } from "../types";
import { styleFor } from "../data/sectorStyle";

interface FilterState {
  sections: string[];
  stages: Stage[];
  employees: EmployeeBucket[];
  cities: string[];
  query: string;
}

interface MapFiltersProps {
  all: EcosystemStartup[];
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}

const STAGE_LABEL: Record<Stage, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c_plus: "Series C+",
  growth: "Growth",
  public: "Public",
  unknown: "Unknown",
};

const EMPLOYEE_LABEL: Record<EmployeeBucket, string> = {
  "1": "Solo",
  "2-10": "2–10",
  "11-50": "11–50",
  "51-200": "51–200",
  "201-500": "201–500",
  "501-1000": "501–1000",
  "1000+": "1000+",
  unknown: "Unknown",
};

export function MapFilters({ all, filters, setFilters }: MapFiltersProps) {
  // Derive available filter options from the loaded data so we never offer
  // an option that won't match anything.
  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of all) {
      if (s.section) counts.set(s.section, (counts.get(s.section) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const stages = useMemo(() => {
    const set = new Set<Stage>();
    for (const s of all) set.add(s.stage);
    return [...set].sort();
  }, [all]);

  const employees = useMemo(() => {
    const set = new Set<EmployeeBucket>();
    for (const s of all) set.add(s.employees);
    return [...set];
  }, [all]);

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of all) {
      if (s.city) counts.set(s.city, (counts.get(s.city) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [all]);

  const toggle = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const filtersActive =
    filters.sections.length +
      filters.stages.length +
      filters.employees.length +
      filters.cities.length +
      (filters.query ? 1 : 0) >
    0;

  return (
    <aside
      className="card"
      style={{
        padding: "20px 18px",
        position: "sticky",
        top: 16,
        alignSelf: "start",
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name or description…"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "var(--white)",
            fontSize: 13,
            color: "var(--charcoal)",
          }}
        />
      </div>

      <FilterGroup title="Sector">
        {sections.map(([name, count]) => {
          const on = filters.sections.includes(name);
          const style = styleFor(name);
          return (
            <FilterRow
              key={name}
              label={style.label}
              count={count}
              on={on}
              swatch={style.color}
              onClick={() =>
                setFilters({ ...filters, sections: toggle(filters.sections, name) })
              }
            />
          );
        })}
      </FilterGroup>

      <FilterGroup title="Stage">
        {stages.map((s) => (
          <FilterRow
            key={s}
            label={STAGE_LABEL[s]}
            on={filters.stages.includes(s)}
            onClick={() =>
              setFilters({ ...filters, stages: toggle(filters.stages, s) })
            }
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Team size">
        {employees.map((e) => (
          <FilterRow
            key={e}
            label={EMPLOYEE_LABEL[e]}
            on={filters.employees.includes(e)}
            onClick={() =>
              setFilters({ ...filters, employees: toggle(filters.employees, e) })
            }
          />
        ))}
      </FilterGroup>

      <FilterGroup title="City">
        {cities.map(([city, count]) => (
          <FilterRow
            key={city}
            label={city.replace(/\b\w/g, (c) => c.toUpperCase())}
            count={count}
            on={filters.cities.includes(city)}
            onClick={() =>
              setFilters({ ...filters, cities: toggle(filters.cities, city) })
            }
          />
        ))}
      </FilterGroup>

      {filtersActive && (
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 6, fontSize: 12 }}
          onClick={() =>
            setFilters({
              sections: [],
              stages: [],
              employees: [],
              cities: [],
              query: "",
            })
          }
        >
          Clear all filters
        </button>
      )}
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="tiny-caps" style={{ marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

interface FilterRowProps {
  label: string;
  on: boolean;
  onClick: () => void;
  count?: number;
  swatch?: string;
}

function FilterRow({ label, on, onClick, count, swatch }: FilterRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "5px 6px",
        borderRadius: 5,
        cursor: "pointer",
        fontSize: 13,
        color: on ? "var(--nucleus-blue)" : "var(--charcoal)",
        fontWeight: on ? 500 : 400,
        background: on ? "var(--blue-50)" : "transparent",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
          background: on ? "var(--nucleus-blue)" : "var(--white)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {on && (
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
            <path
              d="M1.5 4.5 L3.5 6.5 L7.5 2"
              stroke="var(--white)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
      </span>
      {swatch && (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: swatch,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: "var(--slate-light)" }}>{count}</span>
      )}
    </button>
  );
}

export type { FilterState };
