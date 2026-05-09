import { useEffect, useState } from "react";
import type { GoogleUserInfo, Person, PingResult, Startup } from "./types";
import { api } from "./api";
import type { Route } from "./routeHero";
import { SideNav } from "./components/SideNav";
import { ExplorePage } from "./pages/ExplorePage";
import { MatchPage } from "./pages/MatchPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { OnboardPage } from "./pages/OnboardPage";
import { EcosystemPage } from "./ecosystem/EcosystemPage";
import { LinkedInPage } from "./pages/LinkedInPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LandingPage } from "./pages/LandingPage";
import { TopologyPage } from "./topology/TopologyPage";

interface MatchSeed {
  person: Person | null;
  startup: Startup | null;
}

export interface OidcUser {
  name: string;
  email: string;
  picture: string;
  provider: "linkedin" | "google";
}

const POST_LOGIN_ROUTE_KEY = "nucleus.post_login_route";
const OIDC_USER_KEY = "nucleus.oidc_user";

function loadOidcUser(): OidcUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OIDC_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OidcUser>;
    if (parsed && typeof parsed.name === "string" && typeof parsed.picture === "string") {
      return parsed as OidcUser;
    }
  } catch {
    /* corrupt — ignore */
  }
  return null;
}

function persistOidcUser(u: OidcUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (u) localStorage.setItem(OIDC_USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(OIDC_USER_KEY);
  } catch {
    /* private mode — silently skip */
  }
}
const VALID_POST_LOGIN_ROUTES: ReadonlyArray<Route> = [
  "ecosystem",
  "onboard",
  "explore",
  "profile",
];

/**
 * Decide where to land on initial mount.
 *
 * - If the URL has an OAuth handoff token, the browser just came back from
 *   LinkedIn / Google. Read the breadcrumb the originating page stashed in
 *   localStorage to know where to send them. (EcosystemPage stashes
 *   "ecosystem"; LandingPage stashes "onboard".) Consume the breadcrumb on
 *   read so a refresh doesn't repeat it.
 * - If no breadcrumb survives, fall back to "ecosystem" — the page that's
 *   designed to consume the handoff token.
 * - Cold visit (no token) → "landing".
 */
function pickInitialRoute(): Route {
  if (typeof window === "undefined") return "landing";
  const sp = new URL(window.location.href).searchParams;
  const hasHandoff =
    sp.get("linkedin_handoff") ||
    sp.get("google_handoff") ||
    sp.get("demo_signin");
  if (!hasHandoff) return "landing";
  try {
    const stored = localStorage.getItem(POST_LOGIN_ROUTE_KEY);
    localStorage.removeItem(POST_LOGIN_ROUTE_KEY);
    if (stored && (VALID_POST_LOGIN_ROUTES as readonly string[]).includes(stored)) {
      return stored as Route;
    }
  } catch {
    /* private mode / no localStorage — fall through */
  }
  return "ecosystem";
}

export function App() {
  const [route, setRoute] = useState<Route>(pickInitialRoute);
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
  const [oidcUser, setOidcUserState] = useState<OidcUser | null>(loadOidcUser);

  const setOidcUser = (u: OidcUser | null) => {
    setOidcUserState(u);
    persistOidcUser(u);
  };
  const [googleUserinfo, setGoogleUserinfo] = useState<GoogleUserInfo | null>(null);

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

        const params = new URLSearchParams(window.location.search);
        const googleToken = params.get("google_handoff");
        if (googleToken) {
          window.history.replaceState({}, "", window.location.pathname);
          try {
            const info = await api.googleHandoff(googleToken);
            if (dead) return;
            setGoogleUserinfo(info);
            setRoute("onboard");
          } catch (e) {
            if (!dead) {
              setLoadError(
                `Google sign-in handoff failed: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }
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
        oidcUser={oidcUser}
        onSignOut={() => setOidcUser(null)}
      />
      <div className="sidenav-content">
        {loadError && (
          <div
            className="py-20 px-32 text-[#8a3a3a] text-[13px] bg-[#fbe8e0] border-b border-[#f1c8b9]"
          >
            ⚠ {loadError}
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
                googleUserinfo={googleUserinfo}
                onComplete={async (created) => {
                  const refreshed = await reloadPeople();
                  const next = refreshed.find((p) => p.id === created.id) ?? created;
                  setCurrentUser(next);
                  setGoogleUserinfo(null);
                  setRoute("profile");
                }}
              />
            )}
            {route === "topology" && currentUser && (
              <TopologyPage people={people} currentUser={currentUser} />
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
            {route === "ecosystem" && (
              <EcosystemPage
                onSignedIn={(name, email, picture) =>
                  setOidcUser({ name, email, picture, provider: "linkedin" })
                }
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
