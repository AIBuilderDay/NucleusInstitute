import { useEffect, useState } from "react";
import type { Person, PingResult, Startup } from "./types";
import { api } from "./api";
import type { Route } from "./routeHero";
import { SideNav } from "./components/SideNav";
import { ExplorePage } from "./pages/ExplorePage";
import { MatchPage } from "./pages/MatchPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { OnboardPage } from "./pages/OnboardPage";
<<<<<<< HEAD
import { EcosystemPage } from "./ecosystem/EcosystemPage";
=======
import { LinkedInPage } from "./pages/LinkedInPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LandingPage } from "./pages/LandingPage";
>>>>>>> main

interface MatchSeed {
  person: Person | null;
  startup: Startup | null;
}

function pickInitialRoute(): Route {
  // If the browser landed here from a LinkedIn / Google OAuth callback, the
  // URL carries a handoff token. The Ecosystem page is the surface that
  // consumes it (auto-personalizes the matches), so route there on mount
  // regardless of which path the backend redirected to.
  if (typeof window !== "undefined") {
    const sp = new URL(window.location.href).searchParams;
    if (
      sp.get("linkedin_handoff") ||
      sp.get("google_handoff") ||
      sp.get("demo_signin")
    ) {
      return "ecosystem";
    }
  }
  return "browse";
}

export function App() {
<<<<<<< HEAD
  const [route, setRoute] = useState<Route>(pickInitialRoute);
=======
  const [route, setRoute] = useState<Route>("landing");
>>>>>>> main
  const [people, setPeople] = useState<Person[]>([]);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [currentUser, setCurrentUser] = useState<Person | null>(null);
  const [matchSeed, setMatchSeed] = useState<MatchSeed>({ person: null, startup: null });
  const [connectedPersonIds, setConnectedPersonIds] = useState<Set<string>>(new Set());
  const [connectedStartupIds, setConnectedStartupIds] = useState<Set<string>>(new Set());
  const [passedPersonIds, setPassedPersonIds] = useState<Set<string>>(new Set());
  const [passedStartupIds, setPassedStartupIds] = useState<Set<string>>(new Set());
  const [apiState, setApiState] = useState<PingResult>({ live: false });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    void (async () => {
      const ping = await api.ping();
      if (dead) return;
      setApiState(ping);
      if (!ping.live) {
        setLoadError(
          `Cannot reach backend at ${api.base}. Run \`task dev\` (or set VITE_API_BASE_URL).`,
        );
        setLoading(false);
        return;
      }
      try {
        const [ps, ss] = await Promise.all([api.listPeople(), api.listStartups()]);
        if (dead) return;
        setPeople(ps);
        setStartups(ss);
        setCurrentUser(ps[1] ?? ps[0] ?? null);
      } catch (e) {
        if (!dead) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const reloadPeople = async () => {
    const ps = await api.listPeople();
    setPeople(ps);
    return ps;
  };

  const goMatchPerson = (p: Person) => {
    setMatchSeed({ person: p, startup: null });
    setRoute("match");
  };
  const goMatchStartup = (s: Startup) => {
    setMatchSeed({ person: null, startup: s });
    setRoute("match");
  };

  const connectPerson = (p: Person) => {
    setConnectedPersonIds((prev) => new Set(prev).add(p.id));
  };
  const connectStartup = (s: Startup) => {
    setConnectedStartupIds((prev) => new Set(prev).add(s.id));
  };
  const passPerson = (p: Person) => {
    setPassedPersonIds((prev) => new Set(prev).add(p.id));
  };
  const passStartup = (s: Startup) => {
    setPassedStartupIds((prev) => new Set(prev).add(s.id));
  };

  if (route === "landing") {
    return <LandingPage onEnter={() => setRoute("explore")} />;
  }

  return (
<<<<<<< HEAD
    <div>
      {route !== "ecosystem" && <HeroStrip dense {...HERO} />}
      <TopNav route={route} setRoute={setRoute} />

      {loadError && (
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "20px 32px",
            color: "#8a3a3a",
            fontSize: 13,
            background: "#fbe8e0",
            borderBottom: "1px solid #f1c8b9",
          }}
        >
          ⚠ {loadError}
        </div>
      )}

      {loading && !loadError && (
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 32px" }}>
          <div className="shimmer" style={{ height: 120, marginBottom: 12 }} />
          <div className="shimmer" style={{ height: 120, marginBottom: 12 }} />
          <div className="shimmer" style={{ height: 120 }} />
        </div>
      )}

      {!loading && !loadError && (
        <>
          {route === "browse" && (
            <BrowsePage
              people={people}
              startups={startups}
              onMatchPerson={goMatchPerson}
              onMatchStartup={goMatchStartup}
            />
          )}
          {route === "match" && currentUser && (
            <MatchPage
              people={people}
              startups={startups}
              initialPerson={matchSeed.person}
              initialStartup={matchSeed.startup}
              currentUser={currentUser}
            />
          )}
          {route === "profile" && currentUser && (
            <MyProfilePage
              people={people}
              startups={startups}
              currentUser={currentUser}
              onSwitchUser={(id) => {
                const next = people.find((p) => p.id === id);
                if (next) setCurrentUser(next);
              }}
              onMatchPerson={goMatchPerson}
            />
          )}
          {route === "onboard" && (
            <OnboardPage
              onComplete={async (created) => {
                const refreshed = await reloadPeople();
                const next = refreshed.find((p) => p.id === created.id) ?? created;
                setCurrentUser(next);
                setRoute("profile");
              }}
            />
          )}
          {route === "ecosystem" && <EcosystemPage />}
        </>
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
              {apiState.live ? `${api.base} (live)` : `${api.base} (offline)`}
            </span>
=======
    <div className="min-h-screen flex">
      <SideNav
        route={route}
        setRoute={setRoute}
        currentUser={currentUser}
        people={people}
        startups={startups}
        onSelectPerson={goMatchPerson}
        onSelectStartup={goMatchStartup}
        minimal={route === "onboard"}
      />
      <div className="sidenav-content">
        {loadError && (
          <div
            className="py-20 px-32 text-[#8a3a3a] text-[13px] bg-[#fbe8e0] border-b border-[#f1c8b9]"
          >
            ⚠ {loadError}
>>>>>>> main
          </div>
        )}

        {loading && !loadError && (
          <div className="p-32">
            <div className="shimmer h-[120px] mb-12" />
            <div className="shimmer h-[120px] mb-12" />
            <div className="shimmer h-[120px]" />
          </div>
        )}

        {!loading && !loadError && (
          <main className="flex-1">
            {route === "landing" && (
              <LandingPage onEnter={() => setRoute("explore")} />
            )}
            {route === "explore" && (
              <ExplorePage
                people={people}
                startups={startups}
                onConnectPerson={connectPerson}
                onConnectStartup={connectStartup}
                onPassPerson={passPerson}
                onPassStartup={passStartup}
                connectedPersonIds={connectedPersonIds}
                connectedStartupIds={connectedStartupIds}
                passedPersonIds={passedPersonIds}
                passedStartupIds={passedStartupIds}
              />
            )}
            {route === "match" && currentUser && (
              <MatchPage
                people={people}
                startups={startups}
                initialPerson={matchSeed.person}
                initialStartup={matchSeed.startup}
                currentUser={currentUser}
                connectedPersonIds={connectedPersonIds}
                connectedStartupIds={connectedStartupIds}
              />
            )}
            {route === "profile" && currentUser && (
              <MyProfilePage
                people={people}
                startups={startups}
                currentUser={currentUser}
                onSwitchUser={(id) => {
                  const next = people.find((p) => p.id === id);
                  if (next) setCurrentUser(next);
                }}
                onMatchPerson={goMatchPerson}
              />
            )}
            {route === "linkedin" && (
              <LinkedInPage
                onContinue={() => setRoute("onboard")}
                onSkip={() => setRoute("onboard")}
              />
            )}
            {route === "onboard" && (
              <OnboardPage
                onComplete={async (created) => {
                  const refreshed = await reloadPeople();
                  const next = refreshed.find((p) => p.id === created.id) ?? created;
                  setCurrentUser(next);
                  setRoute("profile");
                }}
              />
            )}
            {route === "settings" && currentUser && (
              <SettingsPage
                currentUser={currentUser}
                people={people}
                onSwitchUser={(id) => {
                  const next = people.find((p) => p.id === id);
                  if (next) setCurrentUser(next);
                }}
                apiLive={apiState.live}
              />
            )}
          </main>
        )}

        <footer
          className="p-32 border-t border-pearl-300 bg-pearl mt-0"
        >
          <div
            className="flex justify-between items-center flex-wrap gap-12 text-graphite-muted text-[12px]"
          >
            <div>Innovate Utah · Connections Hub · for Utah's deep-tech ecosystem.</div>
            <div className="font-mono text-[11px] text-graphite-light">
              backend:{" "}
              <span className={apiState.live ? "text-gold" : "text-graphite-muted"}>
                {apiState.live ? `${api.base} (live)` : `${api.base} (offline)`}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
