import { useEffect, useMemo, useState } from "react";
import type { MatchResult, Person, Startup } from "../types";
import { api, connections, hydrateMatches } from "../api";
import {
  NETWORK_LABEL,
  ROLE_CATEGORY_LABEL,
  SECTOR_LABEL,
  STAGE_LABEL,
} from "../labels";
import { Avatar, Pill, ScoreArc, Sidesheet, selectClass } from "../components/ui";
import { ConnectionWeb } from "../components/ConnectionWeb";
import { PersonDetailBody } from "./shared";

interface MyProfilePageProps {
  people: Person[];
  startups: Startup[];
  currentUser: Person;
  onSwitchUser: (id: string) => void;
  onMatchPerson: (p: Person) => void;
}

export function MyProfilePage({
  people,
  startups,
  currentUser,
  onSwitchUser,
  onMatchPerson,
}: MyProfilePageProps) {
  const me = currentUser;
  const conns = useMemo(() => connections(me.id, people), [me.id, people]);
  const [recent, setRecent] = useState<MatchResult[]>([]);
  const [pickedConn, setPickedConn] = useState<Person | null>(null);

  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const r = await api.matchPerson(me.id, { topK: 5 });
        if (dead) return;
        setRecent(hydrateMatches(r.matches, people, startups));
      } catch {
        if (!dead) setRecent([]);
      }
    })();
    return () => {
      dead = true;
    };
  }, [me.id, people, startups]);

  const warm = conns.filter((c) => c.warmth >= 0.6).length;
  const direct = conns.filter((c) => c.warmth >= 0.35).length;
  const total = conns.length;

  return (
    <div>
      <div className="max-w-[1440px] mx-auto pt-32 px-32 pb-24 grid grid-cols-[auto_1fr_auto] gap-28 items-center">
        <Avatar name={me.name} size={84} tone="blue" />
        <div>
          <div className="tiny-caps">
            {ROLE_CATEGORY_LABEL[me.role_category]} · {NETWORK_LABEL[me.primary_network]}
          </div>
          <h1 className="font-display text-[36px] font-normal mt-4 mb-6 text-nucleus-blue tracking-[-0.01em]">
            {me.name}
          </h1>
          <div className="text-[14px] text-graphite">{me.headline}</div>
          <div className="flex gap-6 mt-10 flex-wrap">
            {(me.trust_badges ?? []).map((b) => (
              <Pill key={b} tone="copper">
                ◆ {b}
              </Pill>
            ))}
            {me.sectors_of_interest.slice(0, 3).map((s) => (
              <Pill key={s} tone="blue">
                {SECTOR_LABEL[s]}
              </Pill>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <button className="btn btn-primary" onClick={() => onMatchPerson(me)}>
            Run my match →
          </button>
          <select
            onChange={(e) => onSwitchUser(e.target.value)}
            value={me.id}
            className={`${selectClass} text-[12px]`}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                View as: {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto pt-8 px-32 pb-64 grid grid-cols-[1fr_380px] gap-28">
        <section className="card p-24">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="tiny-caps">Network — Connection web</div>
              <h2 className="font-display text-[26px] text-nucleus-blue mt-4">
                Your Wasatch graph
              </h2>
            </div>
            <div className="flex gap-18">
              <Metric n={warm} l="Warm" sub="≥ 0.6" />
              <Metric n={direct} l="Direct" sub="≥ 0.35" />
              <Metric n={total} l="Reachable" sub="all" />
            </div>
          </div>

          <ConnectionWeb connections={conns} currentUser={me} onPick={setPickedConn} />

          <div className="flex justify-between mt-6 text-[11px] text-graphite-muted">
            <span>Inner ring = warmer (shared sector + university + city + mission)</span>
            <span>· Click a node to inspect</span>
          </div>
        </section>

        <aside className="flex flex-col gap-18">
          <div className="card p-18">
            <div className="tiny-caps">Top startup matches for you</div>
            <h3 className="font-display text-[20px] text-nucleus-blue mt-6 mb-12">
              Today's fits
            </h3>
            {recent.slice(0, 5).map((m, i) => {
              const t = m.startup;
              if (!t) return null;
              return (
                <div
                  key={`${m.startup_id}-${i}`}
                  className={`grid grid-cols-[36px_1fr_auto] gap-10 items-center py-10 ${i ? "border-t border-pearl-200" : ""}`}
                >
                  <ScoreArc score={m.score} size={36} label={false} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-graphite">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-graphite-muted whitespace-nowrap overflow-hidden text-ellipsis">
                      {SECTOR_LABEL[t.sector]} · {STAGE_LABEL[t.stage]}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] ${m.passed_hard_filters ? "text-gold" : "text-graphite-light"}`}
                  >
                    {m.passed_hard_filters ? "open" : "blocked"}
                  </span>
                </div>
              );
            })}
            {!recent.length && <div className="shimmer h-64 mt-8" />}
          </div>

          <div className="card p-18">
            <div className="tiny-caps">Profile completeness</div>
            <ProfileMeter person={me} />
          </div>
        </aside>
      </div>

      <Sidesheet
        open={!!pickedConn}
        onClose={() => setPickedConn(null)}
        title={pickedConn?.name}
        subtitle="Connection · path through Nucleus"
      >
        {pickedConn && (
          <PersonDetailBody
            p={pickedConn}
            onMatch={() => {
              onMatchPerson(pickedConn);
              setPickedConn(null);
            }}
          />
        )}
      </Sidesheet>
    </div>
  );
}

function Metric({ n, l, sub }: { n: number; l: string; sub: string }) {
  return (
    <div className="text-right">
      <div className="font-display text-[30px] text-nucleus-blue leading-none">
        {n}
      </div>
      <div className="text-[11px] text-graphite-muted tracking-[0.06em] uppercase">
        {l} <span className="text-graphite-light">{sub}</span>
      </div>
    </div>
  );
}

function ProfileMeter({ person }: { person: Person }) {
  const checks: Array<{ k: string; v: boolean }> = [
    { k: "Headline", v: !!person.headline },
    { k: "Sectors", v: person.sectors_of_interest.length > 0 },
    { k: "Skills", v: person.skills.length >= 3 },
    { k: "Mission", v: (person.mission_keywords ?? []).length > 0 },
    { k: "Bio", v: !!person.bio },
    { k: "Comp expectations", v: !!person.comp_expectation_type },
    { k: "University", v: (person.university_affiliations ?? []).length > 0 },
  ];
  const done = checks.filter((c) => c.v).length;
  const pct = Math.round((done / checks.length) * 100);
  return (
    <div className="mt-8">
      <div className="flex justify-between items-baseline mb-8">
        <span className="font-display text-[30px] text-gold">
          {pct}%
        </span>
        <span className="text-[11px] text-graphite-muted">
          {done} / {checks.length} fields
        </span>
      </div>
      <div className="h-6 bg-pearl-200 rounded-[3px] overflow-hidden mb-14">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      {checks.map((c) => (
        <div
          key={c.k}
          className="flex justify-between text-[12.5px] py-5 border-t border-pearl-200"
        >
          <span className="text-graphite">{c.k}</span>
          <span className={c.v ? "text-gold" : "text-graphite-light"}>
            {c.v ? "✓" : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
