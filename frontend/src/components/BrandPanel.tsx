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
      className="fixed inset-0 bg-[rgba(15,44,79,0.35)] z-80 flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in w-[480px] max-w-[90vw] bg-blue-50 h-full overflow-y-auto border-l border-pearl-300"
      >
        <div className="px-28 pt-24 pb-24 border-b border-pearl-300">
          <div className="tiny-caps">Brand System</div>
          <h2
            className="font-display text-[30px] mt-6 mb-4 text-nucleus-blue"
          >
            Color tokens
          </h2>
          <p className="m-0 text-graphite-muted text-[13px]">
            <strong>Innovate Utah</strong> palette — cobalt anchor (#0848B8) on pearl
            surfaces, graphite type, and one warm{" "}
            <strong className="text-gold-deep">Wasatch gold</strong> accent for
            energy. Built for a Utah innovation network.
          </p>
        </div>
        <div className="px-28 py-20 grid gap-8">
          {CELLS.map((c) => (
            <div
              key={c.token}
              className="grid grid-cols-[56px_1fr_auto] gap-14 items-center px-12 py-10 bg-white border border-pearl-200 rounded-[8px]"
            >
              <div
                className="h-44 rounded-[6px] border border-[rgba(0,0,0,0.06)]"
                style={{ background: c.v }}
              />
              <div className="flex flex-col leading-[1.2]">
                <span className="font-medium text-graphite text-[13.5px]">
                  {c.name}
                </span>
                <span className="font-mono text-[11px] text-graphite-muted">
                  {c.token}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono text-[11.5px] text-graphite">
                  {c.v}
                </span>
                <span className="text-[10px] tracking-[0.12em] uppercase text-graphite-light">
                  {c.role}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-28 pt-8 pb-32 text-graphite-muted text-[12px] leading-[1.55]">
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
