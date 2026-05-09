import type { EcosystemStartup } from "../types";
import { styleFor } from "../data/sectorStyle";

interface ListViewProps {
  startups: EcosystemStartup[];
  onSelect: (id: string) => void;
}

const STAGE_LABEL: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c_plus: "Series C+",
  growth: "Growth",
  public: "Public",
  unknown: "—",
};

const EMPLOYEE_LABEL: Record<string, string> = {
  "1": "Solo",
  "2-10": "2–10",
  "11-50": "11–50",
  "51-200": "51–200",
  "201-500": "201–500",
  "501-1000": "501–1000",
  "1000+": "1000+",
  unknown: "—",
};

export function ListView({ startups, onSelect }: ListViewProps) {
  if (startups.length === 0) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--slate)" }}>
        No startups match the current filters.
      </div>
    );
  }
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 0.8fr 0.7fr 1fr",
          gap: 16,
          padding: "12px 18px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--pearl-100)",
        }}
      >
        <Header>Name</Header>
        <Header>Sector</Header>
        <Header>Stage</Header>
        <Header>Team</Header>
        <Header>City</Header>
      </div>
      {startups.map((s, i) => {
        const sector = styleFor(s.section);
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.8fr 0.7fr 1fr",
              gap: 16,
              padding: "12px 18px",
              borderBottom:
                i < startups.length - 1 ? "1px solid var(--color-border-soft)" : "none",
              background: "transparent",
              border: 0,
              borderRadius: 0,
              textAlign: "left",
              cursor: "pointer",
              alignItems: "center",
              width: "100%",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pearl-100)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              className="display"
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--nucleus-blue)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: sector.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--charcoal)" }}>{sector.label}</span>
            </span>
            <span style={{ fontSize: 13, color: "var(--slate)" }}>
              {STAGE_LABEL[s.stage] ?? s.stageRaw}
            </span>
            <span style={{ fontSize: 13, color: "var(--slate)" }}>
              {EMPLOYEE_LABEL[s.employees] ?? s.employeesRaw}
            </span>
            <span style={{ fontSize: 13, color: "var(--slate)" }}>
              {s.city ? s.city.replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <span className="tiny-caps">{children}</span>;
}
