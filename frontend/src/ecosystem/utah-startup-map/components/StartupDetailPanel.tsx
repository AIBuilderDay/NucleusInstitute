import type { EcosystemStartup } from "../types";
import { styleFor } from "../data/sectorStyle";
import { Pill } from "../../../components/ui";

interface StartupDetailPanelProps {
  startup: EcosystemStartup | null;
  onClose: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c_plus: "Series C+",
  growth: "Growth",
  public: "Public",
};

const EMPLOYEE_LABEL: Record<string, string> = {
  "1": "Solo",
  "2-10": "2–10",
  "11-50": "11–50",
  "51-200": "51–200",
  "201-500": "201–500",
  "501-1000": "501–1000",
  "1000+": "1000+",
  unknown: "Unknown",
};

export function StartupDetailPanel({ startup, onClose }: StartupDetailPanelProps) {
  if (!startup) return null;
  const sector = styleFor(startup.section);
  const stage = STAGE_LABEL[startup.stage] || startup.stageRaw || "Unknown";
  const team = EMPLOYEE_LABEL[startup.employees] || startup.employeesRaw || "Unknown";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,44,79,0.35)",
        zIndex: 70,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          width: 520,
          maxWidth: "94vw",
          background: "var(--whisper-50)",
          height: "100%",
          overflowY: "auto",
          borderLeft: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            padding: "22px 28px 16px",
            borderBottom: "1px solid var(--color-border)",
            borderTop: `3px solid ${sector.color}`,
            position: "sticky",
            top: 0,
            background: "var(--whisper-50)",
            zIndex: 1,
          }}
        >
          <div className="tiny-caps">{startup.city.replace(/\b\w/g, (c) => c.toUpperCase()) || "Utah"}</div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h2
              className="display"
              style={{
                fontSize: 28,
                fontWeight: 500,
                margin: "4px 0 0",
                color: "var(--nucleus-blue)",
                lineHeight: 1.15,
              }}
            >
              {startup.name}
            </h2>
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
            >
              Close ✕
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 10,
            }}
          >
            <Pill tone="blue">{sector.label}</Pill>
            {stage !== "Unknown" && <Pill>{stage}</Pill>}
            <Pill>{team}</Pill>
          </div>
        </div>

        <div style={{ padding: "24px 28px 48px" }}>
          {startup.description && (
            <p
              style={{
                fontSize: 14,
                color: "var(--charcoal)",
                lineHeight: 1.6,
                margin: "0 0 22px",
                whiteSpace: "pre-wrap",
              }}
            >
              {startup.description}
            </p>
          )}

          <div className="tiny-caps" style={{ marginBottom: 10 }}>
            Details
          </div>
          <DetailRow k="Stage" v={stage} />
          <DetailRow k="Team size" v={team} />
          <DetailRow k="Sector" v={sector.label} />
          <DetailRow k="Address" v={startup.address || "—"} />

          {(startup.website || startup.linkedin) && (
            <>
              <div className="tiny-caps" style={{ margin: "22px 0 10px" }}>
                Links
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {startup.website && (
                  <a
                    href={startup.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                  >
                    Website ↗
                  </a>
                )}
                {startup.linkedin && (
                  <a
                    href={startup.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                  >
                    LinkedIn ↗
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  background: "var(--white)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--nucleus-blue)",
  textDecoration: "none",
  fontWeight: 500,
};

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        padding: "8px 0",
        borderTop: "1px solid var(--color-border-soft)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--slate)" }}>{k}</span>
      <span style={{ color: "var(--charcoal)" }}>{v}</span>
    </div>
  );
}
