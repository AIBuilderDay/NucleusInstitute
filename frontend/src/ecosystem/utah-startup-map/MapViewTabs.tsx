import type { EcosystemView } from "./types";

interface MapViewTabsProps {
  view: EcosystemView;
  setView: (v: EcosystemView) => void;
}

export function MapViewTabs({ view, setView }: MapViewTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--whisper-200)",
        borderRadius: 7,
        padding: 2,
      }}
    >
      {([
        { id: "map", label: "Map" },
        { id: "list", label: "List" },
      ] as const).map((t) => {
        const on = view === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 500,
              minWidth: 64,
              background: on ? "var(--white)" : "transparent",
              color: on ? "var(--nucleus-blue)" : "var(--slate)",
              boxShadow: on ? "0 1px 2px rgba(15,44,79,0.08)" : "none",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
