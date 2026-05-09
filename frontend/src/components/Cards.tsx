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
      className={`card card-hover text-left w-full cursor-pointer grid gap-14 items-start ${
        dense ? "p-14 grid-cols-[auto_1fr]" : "p-18 grid-cols-[auto_1fr_auto]"
      } ${selected ? "border-nucleus-blue shadow-[inset_0_0_0_1px_var(--nucleus-blue)]" : ""}`}
    >
      <Avatar name={p.name} size={dense ? 40 : 48} />
      <div className="min-w-0">
        <div className="flex items-center gap-8 flex-wrap">
          <span
            className={`font-display font-medium text-graphite ${
              dense ? "text-[17px]" : "text-[19px]"
            }`}
          >
            {p.name}
          </span>
          <span className="text-[11px] text-graphite-muted tracking-[0.04em]">
            · {p.location_city}
          </span>
        </div>
        <div className="text-[13px] text-graphite-muted mt-2 mb-8">
          {p.headline}
        </div>
        <div className="flex flex-wrap gap-6">
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
        <div className="flex flex-col items-end gap-6">
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
      className={`card card-hover text-left w-full cursor-pointer grid gap-12 ${
        dense ? "p-14 grid-cols-[1fr]" : "p-18 grid-cols-[1fr_auto]"
      } ${selected ? "border-gold shadow-[inset_0_0_0_1px_var(--gold)]" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-10 flex-wrap">
          <span
            className={`font-display font-medium text-nucleus-blue ${
              dense ? "text-[18px]" : "text-[21px]"
            }`}
          >
            {s.name}
          </span>
          <span className="text-[11px] text-graphite-muted tracking-[0.04em]">
            {s.location_city}
          </span>
        </div>
        <div className="text-[13px] text-graphite mt-4 mb-10">
          {s.one_liner}
        </div>
        <div className="flex flex-wrap gap-6">
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
