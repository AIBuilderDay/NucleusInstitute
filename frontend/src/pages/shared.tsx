import type { Person, Startup } from "../types";
import { NETWORK_LABEL, SECTOR_LABEL, STAGE_LABEL } from "../data";
import { Avatar, DetailGroup, Pill, Stat } from "../components/ui";

interface FilterRowProps<V extends string> {
  label: string;
  options: ReadonlyArray<readonly [V, string]>;
  selected: V[];
  onToggle: (v: V) => void;
}

export function FilterRow<V extends string>({
  label,
  options,
  selected,
  onToggle,
}: FilterRowProps<V>) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span className="tiny-caps" style={{ minWidth: 64 }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(([val, lab]) => {
          const on = selected.includes(val);
          return (
            <button
              key={val}
              onClick={() => onToggle(val)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
                background: on ? "var(--nucleus-blue)" : "var(--white)",
                color: on ? "var(--wasatch-whisper)" : "var(--charcoal)",
                transition: "all 0.12s",
              }}
            >
              {lab}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PersonDetailBody({ p, onMatch }: { p: Person; onMatch: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Avatar name={p.name} size={64} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: "var(--slate)" }}>{p.headline}</div>
          <div style={{ fontSize: 12, color: "var(--slate-light)", marginTop: 4 }}>
            {p.location_city} · {p.years_experience}y · {p.availability.replace("_", " ")}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onMatch}>
          Run match →
        </button>
      </div>

      {p.bio && (
        <div
          style={{
            fontSize: 13.5,
            color: "var(--charcoal)",
            lineHeight: 1.6,
            background: "var(--wasatch-whisper)",
            padding: "14px 16px",
            borderRadius: 8,
          }}
        >
          {p.bio}
        </div>
      )}

      <DetailGroup label="Sectors of interest">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.sectors_of_interest.map((s) => (
            <Pill key={s} tone="blue">
              {SECTOR_LABEL[s]}
            </Pill>
          ))}
        </div>
      </DetailGroup>

      <DetailGroup label="Skills">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.skills.map((s) => (
            <Pill key={s}>{s}</Pill>
          ))}
        </div>
      </DetailGroup>

      {(p.trust_badges ?? []).length > 0 && (
        <DetailGroup label="Trust badges">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.trust_badges?.map((b) => (
              <Pill key={b} tone="copper">
                ◆ {b}
              </Pill>
            ))}
          </div>
        </DetailGroup>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Stat k="Network" v={NETWORK_LABEL[p.primary_network]} />
        <Stat
          k="Risk tolerance"
          v={(p.risk_tolerance ?? "medium").replace(/^./, (c) => c.toUpperCase())}
        />
        <Stat k="Comp expectation" v={p.comp_expectation_type.replace(/_/g, " ")} />
        <Stat
          k="Min salary"
          v={p.comp_min_salary_usd ? `$${p.comp_min_salary_usd.toLocaleString()}` : "—"}
        />
      </div>
    </div>
  );
}

export function StartupDetailBody({ s, onMatch }: { s: Startup; onMatch: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: "var(--slate)" }}>{s.one_liner}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <Pill tone="blue">{SECTOR_LABEL[s.sector]}</Pill>
            <Pill>{STAGE_LABEL[s.stage]}</Pill>
            {s.seeking_investment && <Pill tone="copper">Fundraising</Pill>}
          </div>
        </div>
        <button className="btn btn-copper" onClick={onMatch}>
          Find talent →
        </button>
      </div>

      {s.description && (
        <div
          style={{
            fontSize: 13.5,
            color: "var(--charcoal)",
            lineHeight: 1.6,
            background: "var(--wasatch-whisper)",
            padding: "14px 16px",
            borderRadius: 8,
          }}
        >
          {s.description}
        </div>
      )}

      <DetailGroup label="Roles needed">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {s.roles_needed.map((r) => (
            <Pill key={r} tone="blue">
              + {r.replace("_", " ")}
            </Pill>
          ))}
        </div>
      </DetailGroup>

      <DetailGroup label="Required skills">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {s.required_skills.map((k) => (
            <Pill key={k}>{k}</Pill>
          ))}
        </div>
      </DetailGroup>

      {(s.trust_badges ?? []).length > 0 && (
        <DetailGroup label="Trust badges">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {s.trust_badges?.map((b) => (
              <Pill key={b} tone="copper">
                ◆ {b}
              </Pill>
            ))}
          </div>
        </DetailGroup>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Stat k="Stage" v={STAGE_LABEL[s.stage]} />
        <Stat k="Team size" v={s.team_size} />
        <Stat k="Total raised" v={`$${s.total_raised_usd.toLocaleString()}`} />
        <Stat
          k="Comp ceiling"
          v={s.comp_max_salary_usd ? `$${s.comp_max_salary_usd.toLocaleString()}` : "—"}
        />
      </div>
    </div>
  );
}
