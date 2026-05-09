import type { UserMatch } from "../EcosystemContext";

interface ProfileDescriberProps {
  match: UserMatch;
  onEdit: () => void;
  onReset: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c_plus: "Series C+",
  growth: "Growth",
  public: "Public",
  unknown: "Unknown",
};

const LOOKING_FOR_LABEL: Record<string, string> = {
  resources: "Resources",
  startups: "Startups",
  both: "Both resources & startups",
};

export function ProfileDescriber({ match, onEdit, onReset }: ProfileDescriberProps) {
  return (
    <section
      className="card"
      style={{
        padding: "20px 24px",
        marginBottom: 22,
        background: "var(--blue-50)",
        borderColor: "var(--blue-200)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {match.picture && (
            <img
              src={match.picture}
              alt={match.name}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--blue-200)",
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div className="tiny-caps" style={{ color: "var(--nucleus-blue)" }}>
              What we know about you
            </div>
            <div
              className="display"
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--nucleus-blue)",
                lineHeight: 1.2,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {match.name}
              <span style={{ color: "var(--slate)", fontWeight: 400, fontSize: 16 }}>
                {" · "}
                {match.city}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onEdit} className="btn btn-primary" style={editBtn}>
            Edit
          </button>
          <button onClick={onReset} className="btn btn-ghost" style={editBtn}>
            Reset
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        <Cell label="Sectors">
          {match.sectors.length === 0 ? (
            <Muted>—</Muted>
          ) : (
            <ChipRow items={match.sectors} />
          )}
        </Cell>
        <Cell label="Stages">
          {match.stages.length === 0 ? (
            <Muted>—</Muted>
          ) : (
            <ChipRow
              items={match.stages.map((s) => STAGE_LABEL[s] ?? s)}
              tone="copper"
            />
          )}
        </Cell>
        <Cell label="Looking for">
          {match.lookingFor.length === 0 ? (
            <Muted>—</Muted>
          ) : (
            <ChipRow
              items={match.lookingFor.map((l) => LOOKING_FOR_LABEL[l] ?? l)}
            />
          )}
        </Cell>
        <Cell label="Within">
          <ChipRow
            items={[
              match.distanceMaxMiles == null
                ? "Statewide"
                : `${match.distanceMaxMiles} mi`,
            ]}
            tone="copper"
          />
        </Cell>
      </div>
      {match.keywords.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="tiny-caps" style={{ marginBottom: 6 }}>
            Keywords
          </div>
          <ChipRow items={match.keywords} />
        </div>
      )}
    </section>
  );
}

const editBtn: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12.5,
};

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="tiny-caps" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 13, color: "var(--slate-light)" }}>{children}</span>;
}

function ChipRow({
  items,
  tone = "blue",
}: {
  items: string[];
  tone?: "blue" | "copper";
}) {
  const styles = tone === "copper"
    ? {
        bg: "var(--copper-faint)",
        color: "#8a5e1f",
        border: "rgba(200, 146, 74, 0.3)",
      }
    : {
        bg: "var(--white)",
        color: "var(--nucleus-blue)",
        border: "var(--blue-200)",
      };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((s) => (
        <span
          key={s}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            background: styles.bg,
            color: styles.color,
            border: `1px solid ${styles.border}`,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
