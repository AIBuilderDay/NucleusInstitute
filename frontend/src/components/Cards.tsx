import type { ReactNode } from "react";
import type { Person, Startup } from "../types";
import { NETWORK_LABEL, SECTOR_LABEL, STAGE_LABEL } from "../labels";
import { Avatar, Pill, cardKeyHandler } from "./ui";

interface PersonCardProps {
  p: Person;
  selected?: boolean;
  onClick?: () => void;
  dense?: boolean;
  badge?: ReactNode;
}

export function PersonCard({
  p,
  selected = false,
  onClick,
  dense = false,
  badge = null,
}: PersonCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={cardKeyHandler(onClick)}
      className="card card-hover"
      style={{
        textAlign: "left",
        padding: dense ? 14 : 18,
        width: "100%",
        cursor: "pointer",
        borderColor: selected ? "var(--nucleus-blue)" : undefined,
        boxShadow: selected ? "0 0 0 1px var(--nucleus-blue) inset" : undefined,
        display: "grid",
        gridTemplateColumns: dense ? "auto 1fr" : "auto 1fr auto",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <Avatar name={p.name} size={dense ? 40 : 48} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            className="display"
            style={{ fontSize: dense ? 17 : 19, fontWeight: 500, color: "var(--charcoal)" }}
          >
            {p.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--slate)", letterSpacing: "0.04em" }}>
            · {p.location_city}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 2, marginBottom: 8 }}>
          {p.headline}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.sectors_of_interest.slice(0, 3).map((s) => (
            <Pill key={s} tone="blue">
              {SECTOR_LABEL[s]}
            </Pill>
          ))}
          {p.role_titles_seeking
            .slice(0, 2)
            .filter((r) => r !== "other")
            .map((r) => (
              <Pill key={r}>{r.replace("_", " ")}</Pill>
            ))}
        </div>
      </div>
      {!dense && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {badge}
          <span className="tiny-caps">
            {NETWORK_LABEL[p.primary_network].split(" ")[0]}
          </span>
        </div>
      )}
    </div>
  );
}

interface StartupCardProps {
  s: Startup;
  selected?: boolean;
  onClick?: () => void;
  dense?: boolean;
  badge?: ReactNode;
}

export function StartupCard({
  s,
  selected = false,
  onClick,
  dense = false,
  badge = null,
}: StartupCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={cardKeyHandler(onClick)}
      className="card card-hover"
      style={{
        textAlign: "left",
        padding: dense ? 14 : 18,
        width: "100%",
        cursor: "pointer",
        borderColor: selected ? "var(--copper)" : undefined,
        boxShadow: selected ? "0 0 0 1px var(--copper) inset" : undefined,
        display: "grid",
        gridTemplateColumns: dense ? "1fr" : "1fr auto",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span
            className="display"
            style={{
              fontSize: dense ? 18 : 21,
              fontWeight: 500,
              color: "var(--nucleus-blue)",
            }}
          >
            {s.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--slate)", letterSpacing: "0.04em" }}>
            {s.location_city}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--charcoal)", marginTop: 4, marginBottom: 10 }}>
          {s.one_liner}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Pill tone="blue">{SECTOR_LABEL[s.sector]}</Pill>
          <Pill>{STAGE_LABEL[s.stage]}</Pill>
          {s.roles_needed.slice(0, 3).map((r) => (
            <Pill key={r}>+ {r.replace("_", " ")}</Pill>
          ))}
        </div>
      </div>
      {!dense && badge && <div>{badge}</div>}
    </div>
  );
}
