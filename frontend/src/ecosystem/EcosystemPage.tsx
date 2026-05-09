import { useEffect, useRef, useState } from "react";
import { FounderNavigator } from "./founder-navigator/FounderNavigator";
import { UtahStartupMap } from "./utah-startup-map/UtahStartupMap";
import {
  EcosystemProvider,
  useEcosystem,
  type UserMatch,
} from "./EcosystemContext";
import { InterestModal } from "./components/InterestModal";
import { MatchedView } from "./components/MatchedView";
import {
  linkedInLoginUrl,
  popLinkedInHandoff,
  type LinkedInUserinfo,
} from "./inferenceApi";

export function EcosystemPage() {
  return (
    <EcosystemProvider>
      <EcosystemBody />
    </EcosystemProvider>
  );
}

function EcosystemBody() {
  const { match, setMatch } = useEcosystem();
  const [pendingUserinfo, setPendingUserinfo] = useState<LinkedInUserinfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const matchedSectionRef = useRef<HTMLDivElement | null>(null);

  // — Detect ?linkedin_handoff=… or ?demo_signin=1 on mount —
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("linkedin_handoff");
    const demo = url.searchParams.get("demo_signin");

    if (token) {
      url.searchParams.delete("linkedin_handoff");
      window.history.replaceState({}, "", url.toString());
      void (async () => {
        try {
          const userinfo = await popLinkedInHandoff(token);
          setPendingUserinfo(userinfo);
        } catch (e) {
          setHandoffError(e instanceof Error ? e.message : String(e));
        }
      })();
      return;
    }

    if (demo) {
      url.searchParams.delete("demo_signin");
      window.history.replaceState({}, "", url.toString());
      setPendingUserinfo({
        sub: "demo-1234",
        name: "Eddy Kim",
        given_name: "Eddy",
        family_name: "Kim",
        email: "eddy@example.com",
        picture: "https://i.pravatar.cc/120?u=eddy",
        locale: "en-US",
      });
    }
  }, []);

  // — Smooth-scroll the matched layout into view after confirm —
  useEffect(() => {
    if (!match) return;
    const t = setTimeout(() => {
      matchedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => clearTimeout(t);
  }, [match]);

  const onSignInClick = () => {
    try {
      localStorage.setItem("nucleus.post_login_route", "ecosystem");
    } catch {
      /* private mode */
    }
    window.location.href = linkedInLoginUrl();
  };

  return (
    <div
      style={{
        maxWidth: 1680,
        margin: "0 auto",
        padding: "28px 24px 48px",
      }}
    >
      <Hero
        match={match}
        onSignInClick={onSignInClick}
        handoffError={handoffError}
      />

      <div ref={matchedSectionRef}>
        {match ? (
          <MatchedView
            match={match}
            onEdit={() => setEditing(true)}
            onReset={() => setMatch(null)}
          />
        ) : (
          <PreMatchSplit />
        )}
      </div>

      {/* — sign-in flow modal (reading + confirm phases) — */}
      <InterestModal
        userinfo={pendingUserinfo}
        onCancel={() => setPendingUserinfo(null)}
        onConfirm={(m: UserMatch) => {
          setMatch(m);
          setPendingUserinfo(null);
        }}
      />

      {/* — edit-existing-match modal (skips reading phase) — */}
      {editing && match && (
        <InterestModal
          userinfo={null}
          editingMatch={match}
          onCancel={() => setEditing(false)}
          onConfirm={(m: UserMatch) => {
            setMatch(m);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function PreMatchSplit() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        alignItems: "start",
      }}
    >
      <FounderNavigator />
      <UtahStartupMap />
    </div>
  );
}

interface HeroProps {
  match: UserMatch | null;
  onSignInClick: () => void;
  handoffError: string | null;
}

function Hero({ match, onSignInClick, handoffError }: HeroProps) {
  return (
    <header style={{ marginBottom: 24, textAlign: "center" }}>
      <div className="tiny-caps" style={{ color: "var(--nucleus-blue)" }}>
        Innovate Utah · Ecosystem
      </div>
      <h1
        className="display"
        style={{
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "-0.012em",
          color: "var(--nucleus-blue)",
          margin: "6px 0 14px",
          lineHeight: 1.12,
        }}
      >
        The Utah Ecosystem
      </h1>

      {!match && (
        <button onClick={onSignInClick} className="btn btn-copper" style={signInBtn}>
          <LinkedInGlyph /> Sign in with LinkedIn for personalized matches
        </button>
      )}

      {handoffError && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "#fbe8e0",
            color: "#8a3a3a",
            fontSize: 13,
            borderRadius: 8,
            display: "inline-block",
          }}
        >
          ⚠ Could not finish sign-in: {handoffError}
        </div>
      )}
    </header>
  );
}

function LinkedInGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.48-.9 1.65-1.85 3.4-1.85 3.64 0 4.31 2.4 4.31 5.51v6.23zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

const signInBtn: React.CSSProperties = {
  padding: "11px 22px",
  fontSize: 14,
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};
