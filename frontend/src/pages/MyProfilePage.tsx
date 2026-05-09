import { useEffect, useMemo, useState } from "react";
import type { MatchResult, Person, Startup } from "../types";
import { api, connections, hydrateMatches } from "../api";
import {
  NETWORK_LABEL,
  ROLE_CATEGORY_LABEL,
  SECTOR_LABEL,
  STAGE_LABEL,
} from "../labels";
import { Avatar, Pill, ScoreArc, Sidesheet, selectStyle } from "../components/ui";
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
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "32px 32px 24px",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 28,
          alignItems: "center",
        }}
      >
        <Avatar name={me.name} size={84} tone="blue" />
        <div>
          <div className="tiny-caps">
            {ROLE_CATEGORY_LABEL[me.role_category]} · {NETWORK_LABEL[me.primary_network]}
          </div>
          <h1
            className="display"
            style={{
              fontSize: 36,
              fontWeight: 400,
              margin: "4px 0 6px",
              color: "var(--nucleus-blue)",
              letterSpacing: "-0.01em",
            }}
          >
            {me.name}
          </h1>
          <div style={{ fontSize: 14, color: "var(--charcoal)" }}>{me.headline}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => onMatchPerson(me)}>
            Run my match →
          </button>
          <select
            onChange={(e) => onSwitchUser(e.target.value)}
            value={me.id}
            style={{ ...selectStyle, fontSize: 12 }}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                View as: {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "8px 32px 64px",
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 28,
        }}
      >
        <section className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div>
              <div className="tiny-caps">Network — Connection web</div>
              <h2
                className="display"
                style={{ fontSize: 26, color: "var(--nucleus-blue)", margin: "4px 0 0" }}
              >
                Your Wasatch graph
              </h2>
            </div>
            <div style={{ display: "flex", gap: 18 }}>
              <Metric n={warm} l="Warm" sub="≥ 0.6" />
              <Metric n={direct} l="Direct" sub="≥ 0.35" />
              <Metric n={total} l="Reachable" sub="all" />
            </div>
          </div>

          <ConnectionWeb connections={conns} currentUser={me} onPick={setPickedConn} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 11,
              color: "var(--slate)",
            }}
          >
            <span>Inner ring = warmer (shared sector + university + city + mission)</span>
            <span>· Click a node to inspect</span>
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="tiny-caps">Top startup matches for you</div>
            <h3
              className="display"
              style={{ fontSize: 20, color: "var(--nucleus-blue)", margin: "6px 0 12px" }}
            >
              Today's fits
            </h3>
            {recent.slice(0, 5).map((m, i) => {
              const t = m.startup;
              if (!t) return null;
              return (
                <div
                  key={`${m.startup_id}-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i ? "1px solid var(--color-border-soft)" : "none",
                  }}
                >
                  <ScoreArc score={m.score} size={36} label={false} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--charcoal)" }}>
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--slate)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {SECTOR_LABEL[t.sector]} · {STAGE_LABEL[t.stage]}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: m.passed_hard_filters ? "var(--copper)" : "var(--slate-light)",
                    }}
                  >
                    {m.passed_hard_filters ? "open" : "blocked"}
                  </span>
                </div>
              );
            })}
            {!recent.length && <div className="shimmer" style={{ height: 64, marginTop: 8 }} />}
          </div>

          <div className="card" style={{ padding: 18 }}>
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
    <div style={{ textAlign: "right" }}>
      <div className="display" style={{ fontSize: 30, color: "var(--nucleus-blue)", lineHeight: 1 }}>
        {n}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--slate)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {l} <span style={{ color: "var(--slate-light)" }}>{sub}</span>
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
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span className="display" style={{ fontSize: 30, color: "var(--copper)" }}>
          {pct}%
        </span>
        <span style={{ fontSize: 11, color: "var(--slate)" }}>
          {done} / {checks.length} fields
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--whisper-200)",
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--copper)" }} />
      </div>
      {checks.map((c) => (
        <div
          key={c.k}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
            padding: "5px 0",
            borderTop: "1px solid var(--color-border-soft)",
          }}
        >
          <span style={{ color: "var(--charcoal)" }}>{c.k}</span>
          <span style={{ color: c.v ? "var(--copper)" : "var(--slate-light)" }}>
            {c.v ? "✓" : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
