import { useMemo, useState } from "react";
import type { Network, Person, Sector, Stage, Startup } from "../types";
import {
  NETWORK_LABEL,
  PEOPLE,
  SECTORS,
  SECTOR_LABEL,
  STAGE_LABEL,
  STARTUPS,
} from "../data";
import { Sidesheet } from "../components/ui";
import { SwipeDeck } from "../components/SwipeDeck";
import { FilterRow, PersonDetailBody, StartupDetailBody } from "./shared";

interface BrowsePageProps {
  onMatchPerson: (p: Person) => void;
  onMatchStartup: (s: Startup) => void;
}

type Tab = "people" | "startups";
type Detail =
  | { kind: "person"; item: Person }
  | { kind: "startup"; item: Startup }
  | null;

export function BrowsePage({ onMatchPerson, onMatchStartup }: BrowsePageProps) {
  const [tab, setTab] = useState<Tab>("people");
  const [sectorFilter, setSectorFilter] = useState<Sector[]>([]);
  const [networkFilter, setNetworkFilter] = useState<Network[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage[]>([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Detail>(null);

  const people = useMemo(() => {
    const q = query.toLowerCase();
    return PEOPLE.filter((p) => {
      if (sectorFilter.length && !p.sectors_of_interest.some((s) => sectorFilter.includes(s)))
        return false;
      if (networkFilter.length && !networkFilter.includes(p.primary_network)) return false;
      if (q && !(p.name + " " + p.headline + " " + p.skills.join(" ")).toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [sectorFilter, networkFilter, query]);

  const startups = useMemo(() => {
    const q = query.toLowerCase();
    return STARTUPS.filter((s) => {
      if (
        sectorFilter.length &&
        !sectorFilter.includes(s.sector) &&
        !(s.sectors_secondary ?? []).some((x) => sectorFilter.includes(x))
      )
        return false;
      if (stageFilter.length && !stageFilter.includes(s.stage)) return false;
      if (q && !(s.name + " " + s.one_liner).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sectorFilter, stageFilter, query]);

  function toggle<V>(arr: V[], set: (v: V[]) => void, val: V) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  return (
    <div>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 32px 64px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--whisper-200)",
              borderRadius: 8,
              padding: 3,
            }}
          >
            {(["people", "startups"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  background: tab === t ? "var(--white)" : "transparent",
                  color: tab === t ? "var(--nucleus-blue)" : "var(--slate)",
                  boxShadow: tab === t ? "0 1px 2px rgba(15,44,79,0.08)" : "none",
                }}
              >
                {t === "people" ? `People · ${people.length}` : `Startups · ${startups.length}`}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
            <input
              type="text"
              placeholder={`Search ${tab}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 36px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--white)",
                fontSize: 13.5,
                color: "var(--charcoal)",
              }}
            />
            <span style={{ position: "absolute", left: 12, top: 10, color: "var(--slate-light)" }}>
              ⌕
            </span>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSectorFilter([]);
                setNetworkFilter([]);
                setStageFilter([]);
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <FilterRow<Sector>
            label="Sector"
            options={SECTORS.map((s) => [s, SECTOR_LABEL[s]] as const)}
            selected={sectorFilter}
            onToggle={(v) => toggle(sectorFilter, setSectorFilter, v)}
          />
          {tab === "people" && (
            <FilterRow<Network>
              label="Network"
              options={
                Object.entries(NETWORK_LABEL) as Array<[Network, string]>
              }
              selected={networkFilter}
              onToggle={(v) => toggle(networkFilter, setNetworkFilter, v)}
            />
          )}
          {tab === "startups" && (
            <FilterRow<Stage>
              label="Stage"
              options={Object.entries(STAGE_LABEL) as Array<[Stage, string]>}
              selected={stageFilter}
              onToggle={(v) => toggle(stageFilter, setStageFilter, v)}
            />
          )}
        </div>

        {tab === "people" ? (
          <SwipeDeck
            items={people}
            kind="person"
            onView={(p) => setDetail({ kind: "person", item: p as Person })}
            onConnect={(p) => onMatchPerson(p as Person)}
            onPass={() => {}}
            emptyText="Adjust filters or start over to see more people."
          />
        ) : (
          <SwipeDeck
            items={startups}
            kind="startup"
            onView={(s) => setDetail({ kind: "startup", item: s as Startup })}
            onConnect={(s) => onMatchStartup(s as Startup)}
            onPass={() => {}}
            emptyText="Adjust filters or start over to see more startups."
          />
        )}
      </div>

      <Sidesheet
        open={!!detail && detail.kind === "person"}
        onClose={() => setDetail(null)}
        title={detail?.kind === "person" ? detail.item.name : ""}
        subtitle="Profile · Operator Network"
        accent="blue"
      >
        {detail?.kind === "person" && (
          <PersonDetailBody
            p={detail.item}
            onMatch={() => {
              onMatchPerson(detail.item);
              setDetail(null);
            }}
          />
        )}
      </Sidesheet>
      <Sidesheet
        open={!!detail && detail.kind === "startup"}
        onClose={() => setDetail(null)}
        title={detail?.kind === "startup" ? detail.item.name : ""}
        subtitle="Startup · seeking matches"
        accent="copper"
      >
        {detail?.kind === "startup" && (
          <StartupDetailBody
            s={detail.item}
            onMatch={() => {
              onMatchStartup(detail.item);
              setDetail(null);
            }}
          />
        )}
      </Sidesheet>
    </div>
  );
}
