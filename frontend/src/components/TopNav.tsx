import type { Route } from "../routeHero";

interface TopNavProps {
  route: Route;
  setRoute: (r: Route) => void;
}

const TABS: ReadonlyArray<{ id: Route; label: string }> = [
  { id: "browse", label: "Browse" },
  { id: "match", label: "Match" },
  { id: "ecosystem", label: "Ecosystem" },
  { id: "profile", label: "My Profile" },
  { id: "onboard", label: "Join" },
];

export function TopNav({ route, setRoute }: TopNavProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--sand-50)",
        borderBottom: "1px solid var(--sand-300)",
      }}
    >
      <nav
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "6px 28px 0",
          display: "flex",
          gap: 4,
          alignItems: "flex-end",
        }}
      >
        <button
          onClick={() => setRoute("browse")}
          aria-label="Innovate Utah — home"
          style={{
            padding: "6px 16px 6px 0",
            display: "flex",
            alignItems: "center",
            background: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          <img
            src="/InnovateUtah.png"
            alt="Innovate Utah"
            style={{ height: 38, width: "auto", display: "block" }}
          />
        </button>
        {TABS.map((t) => {
          const on = route === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setRoute(t.id)}
              style={{
                padding: "10px 18px 11px",
                position: "relative",
                borderRadius: 0,
                color: on ? "var(--nucleus-blue)" : "var(--ink-muted)",
                fontFamily: "var(--font-display)",
                fontSize: on ? 22 : 21,
                fontWeight: 400,
                fontStyle: on ? "italic" : "normal",
                letterSpacing: "-0.005em",
                lineHeight: 1,
                transition: "color 0.12s",
              }}
            >
              {t.label}
              <span
                style={{
                  position: "absolute",
                  left: 18,
                  right: 18,
                  bottom: -1,
                  height: 2,
                  background: on ? "var(--nucleus-blue)" : "transparent",
                  transition: "background 0.15s",
                }}
              />
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
      </nav>
    </header>
  );
}
