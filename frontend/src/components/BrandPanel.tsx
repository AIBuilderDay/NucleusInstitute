interface BrandPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Cell {
  name: string;
  v: string;
  role: string;
  token: string;
}

const CELLS: Cell[] = [
  { name: "Nucleus Cobalt", v: "#0848B8", role: "PRIMARY", token: "--nucleus-blue" },
  { name: "Blue 700", v: "#073A98", role: "hover", token: "--blue-700" },
  { name: "Blue 600", v: "#0E54CC", role: "link · solid", token: "--blue-600" },
  { name: "Blue 500", v: "#2D6FE0", role: "highlight", token: "--blue-500" },
  { name: "Blue 300", v: "#6E97EB", role: "chart stroke", token: "--blue-300" },
  { name: "Blue 100", v: "#DCE6FA", role: "tint fill", token: "--blue-100" },
  { name: "Blue 50", v: "#F2F6FE", role: "accent bg", token: "--blue-50" },
  { name: "Pearl", v: "#FAFBFD", role: "PAGE BG", token: "--pearl" },
  { name: "Pearl 200", v: "#EFF2F7", role: "divider", token: "--pearl-200" },
  { name: "Pearl 300", v: "#E2E6EE", role: "border", token: "--pearl-300" },
  { name: "Graphite", v: "#1A2233", role: "body / heads", token: "--graphite" },
  { name: "Graphite Muted", v: "#5A6478", role: "secondary", token: "--graphite-muted" },
  { name: "Graphite Light", v: "#94A0B5", role: "placeholder", token: "--graphite-light" },
  { name: "Wasatch Gold", v: "#D89A36", role: "ACCENT · match", token: "--gold" },
  { name: "Gold Soft", v: "#F4DEA8", role: "accent tint", token: "--gold-soft" },
  { name: "Coral", v: "#E16A4D", role: "ACCENT · spotlight", token: "--coral" },
  { name: "Coral Soft", v: "#FBE0D6", role: "accent tint", token: "--coral-soft" },
  { name: "Sage", v: "#5A9D8C", role: "ACCENT · growth", token: "--sage" },
  { name: "Sage Soft", v: "#DEF0EA", role: "accent tint", token: "--sage-soft" },
  { name: "Plum", v: "#7C5AA0", role: "ACCENT · community", token: "--plum" },
  { name: "Plum Soft", v: "#ECE3F4", role: "accent tint", token: "--plum-soft" },
];

export function BrandPanel({ open, onClose }: BrandPanelProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,44,79,0.35)",
        zIndex: 80,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          width: 480,
          maxWidth: "90vw",
          background: "var(--whisper-50)",
          height: "100%",
          overflowY: "auto",
          borderLeft: "1px solid var(--color-border)",
        }}
      >
        <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--color-border)" }}>
          <div className="tiny-caps">Brand System</div>
          <h2
            className="display"
            style={{ fontSize: 30, margin: "6px 0 4px", color: "var(--nucleus-blue)" }}
          >
            Color tokens
          </h2>
          <p style={{ margin: 0, color: "var(--slate)", fontSize: 13 }}>
            <strong>Innovate Utah</strong> palette — cobalt anchor (#0848B8) on pearl
            surfaces, graphite type, and one warm{" "}
            <strong style={{ color: "var(--gold-deep)" }}>Wasatch gold</strong> accent for
            energy. Built for a Utah innovation network.
          </p>
        </div>
        <div style={{ padding: "20px 28px", display: "grid", gap: 8 }}>
          {CELLS.map((c) => (
            <div
              key={c.token}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr auto",
                gap: 14,
                alignItems: "center",
                padding: "10px 12px",
                background: "white",
                border: "1px solid var(--color-border-soft)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  height: 44,
                  background: c.v,
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontWeight: 500, color: "var(--charcoal)", fontSize: 13.5 }}>
                  {c.name}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--slate)" }}>
                  {c.token}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 2,
                }}
              >
                <span className="mono" style={{ fontSize: 11.5, color: "var(--charcoal)" }}>
                  {c.v}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--slate-light)",
                  }}
                >
                  {c.role}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 28px 32px", color: "var(--slate)", fontSize: 12, lineHeight: 1.55 }}>
          <p>
            <strong>Usage rules:</strong> Sub-brand lockups are always Blue-on-Whisper or
            White-on-Blue — no other tints. Headings: Newsreader serif in Nucleus Blue. Body:
            Geist sans in Charcoal.
          </p>
        </div>
      </div>
    </div>
  );
}
