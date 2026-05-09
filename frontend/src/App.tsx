import { useEffect, useState } from "react";
import type { Person, PingResult, Startup } from "./types";
import { PEOPLE, api } from "./data";
import { ROUTE_HERO, type Route } from "./routeHero";
import { HeroStrip } from "./components/HeroStrip";
import { TopNav } from "./components/TopNav";
import { BrowsePage } from "./pages/BrowsePage";
import { MatchPage } from "./pages/MatchPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { OnboardPage } from "./pages/OnboardPage";

interface MatchSeed {
  person: Person | null;
  startup: Startup | null;
}

const DEFAULT_USER: Person = PEOPLE[1] ?? PEOPLE[0]!;

export function App() {
  const [route, setRoute] = useState<Route>("browse");
  const [currentUser, setCurrentUser] = useState<Person>(DEFAULT_USER);
  const [matchSeed, setMatchSeed] = useState<MatchSeed>({ person: null, startup: null });
  const [apiState, setApiState] = useState<PingResult>({ live: false });

  const hero = ROUTE_HERO[route];

  useEffect(() => {
    let dead = false;
    void (async () => {
      const r = await api.ping();
      if (!dead) setApiState({ ...r, url: api.base });
    })();
    return () => {
      dead = true;
    };
  }, []);

  const goMatchPerson = (p: Person) => {
    setMatchSeed({ person: p, startup: null });
    setRoute("match");
  };
  const goMatchStartup = (s: Startup) => {
    setMatchSeed({ person: null, startup: s });
    setRoute("match");
  };

  return (
    <div>
      <HeroStrip dense {...hero} />
      <TopNav route={route} setRoute={setRoute} />

      {route === "browse" && (
        <BrowsePage onMatchPerson={goMatchPerson} onMatchStartup={goMatchStartup} />
      )}
      {route === "match" && (
        <MatchPage
          initialPerson={matchSeed.person}
          initialStartup={matchSeed.startup}
          currentUser={currentUser}
        />
      )}
      {route === "profile" && (
        <MyProfilePage
          currentUser={currentUser}
          onSwitchUser={(id) => {
            const next = PEOPLE.find((p) => p.id === id);
            if (next) setCurrentUser(next);
          }}
          onMatchPerson={goMatchPerson}
        />
      )}
      {route === "onboard" && (
        <OnboardPage
          onComplete={(profile) => {
            if (!PEOPLE.find((p) => p.id === profile.id)) {
              PEOPLE.push(profile);
            }
            setCurrentUser(profile);
            setRoute("profile");
          }}
        />
      )}

      <footer
        style={{
          padding: "32px 32px 48px",
          maxWidth: 1440,
          margin: "0 auto",
          borderTop: "1px solid var(--color-border)",
          color: "var(--slate)",
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>Innovate Utah · Connections Hub · for Utah's deep-tech ecosystem.</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-light)" }}>
            backend:{" "}
            <span style={{ color: apiState.live ? "var(--copper)" : "var(--slate)" }}>
              {apiState.live ? `${api.base} (live)` : "local mock"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
