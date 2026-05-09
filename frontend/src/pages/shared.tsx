import type { Person, Startup } from "../types";
import { NETWORK_LABEL, SECTOR_LABEL, STAGE_LABEL } from "../labels";
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
    <div className="flex items-center gap-12 flex-wrap">
      <span className="tiny-caps min-w-64">
        {label}
      </span>
      <div className="flex flex-wrap gap-6">
        {options.map(([val, lab]) => {
          const on = selected.includes(val);
          return (
            <button
              key={val}
              onClick={() => onToggle(val)}
              className={`py-5 px-12 rounded-full text-[12px] font-medium border transition-all duration-[0.12s] ${
                on
                  ? "border-nucleus-blue bg-nucleus-blue text-blue-50"
                  : "border-pearl-300 bg-white text-graphite"
              }`}
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
    <div className="flex flex-col gap-18">
      <div className="flex gap-14 items-start">
        <Avatar name={p.name} size={64} />
        <div className="flex-1">
          <div className="text-[14px] text-graphite-muted">{p.headline}</div>
          <div className="text-[12px] text-graphite-light mt-4">
            {p.location_city} · {p.years_experience}y · {p.availability.replace("_", " ")}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onMatch}>
          Run match →
        </button>
      </div>

      {p.bio && (
        <div className="text-[13.5px] text-graphite leading-[1.6] bg-blue-50 py-14 px-16 rounded-[8px]">
          {p.bio}
        </div>
      )}

      <DetailGroup label="Sectors of interest">
        <div className="flex flex-wrap gap-6">
          {p.sectors_of_interest.map((s) => (
            <Pill key={s} tone="blue">
              {SECTOR_LABEL[s]}
            </Pill>
          ))}
        </div>
      </DetailGroup>

      <DetailGroup label="Skills">
        <div className="flex flex-wrap gap-6">
          {p.skills.map((s) => (
            <Pill key={s}>{s}</Pill>
          ))}
        </div>
      </DetailGroup>

      {(p.trust_badges ?? []).length > 0 && (
        <DetailGroup label="Trust badges">
          <div className="flex flex-wrap gap-6">
            {p.trust_badges?.map((b) => (
              <Pill key={b} tone="copper">
                ◆ {b}
              </Pill>
            ))}
          </div>
        </DetailGroup>
      )}

      <div className="grid grid-cols-2 gap-12">
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
    <div className="flex flex-col gap-18">
      <div className="flex justify-between items-start gap-14">
        <div>
          <div className="text-[14px] text-graphite-muted">{s.one_liner}</div>
          <div className="flex flex-wrap gap-6 mt-10">
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
        <div className="text-[13.5px] text-graphite leading-[1.6] bg-blue-50 py-14 px-16 rounded-[8px]">
          {s.description}
        </div>
      )}

      <DetailGroup label="Roles needed">
        <div className="flex flex-wrap gap-6">
          {s.roles_needed.map((r) => (
            <Pill key={r} tone="blue">
              + {r.replace("_", " ")}
            </Pill>
          ))}
        </div>
      </DetailGroup>

      <DetailGroup label="Required skills">
        <div className="flex flex-wrap gap-6">
          {s.required_skills.map((k) => (
            <Pill key={k}>{k}</Pill>
          ))}
        </div>
      </DetailGroup>

      {(s.trust_badges ?? []).length > 0 && (
        <DetailGroup label="Trust badges">
          <div className="flex flex-wrap gap-6">
            {s.trust_badges?.map((b) => (
              <Pill key={b} tone="copper">
                ◆ {b}
              </Pill>
            ))}
          </div>
        </DetailGroup>
      )}

      <div className="grid grid-cols-2 gap-12">
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
