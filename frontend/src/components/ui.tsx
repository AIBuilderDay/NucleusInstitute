import type { KeyboardEvent, ReactNode } from "react";
import type { DimensionScores } from "../types";

// ── Logo + Monogram — Innovate Utah ───────────────────────────────────────────
interface IUMonogramProps {
  size?: number;
  color?: string;
  bg?: string;
}

export function IUMonogram({
  size = 28,
  color = "var(--nucleus-blue)",
  bg = "var(--white)",
}: IUMonogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="7" fill={color} />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily='"Newsreader", serif'
        fontSize="21"
        fontWeight="500"
        fill={bg}
        letterSpacing="-0.04em"
      >
        IU
      </text>
      <path
        d="M 11 9 L 16 4 L 20 7 L 24 4 L 29 9"
        stroke={bg}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

interface IUWordmarkProps {
  inverse?: boolean;
}

export function IUWordmark({ inverse = false }: IUWordmarkProps) {
  const colorClass = inverse ? "text-white" : "text-nucleus-blue";
  return (
    <div className="flex items-center gap-11">
      <IUMonogram
        size={34}
        color={inverse ? "var(--white)" : "var(--nucleus-blue)"}
        bg={inverse ? "var(--nucleus-blue)" : "var(--white)"}
      />
      <div className="flex flex-col leading-none">
        <span
          className={`font-display font-medium tracking-[-0.012em] text-[20.5px] ${colorClass}`}
        >
          Innovate{" "}
          <span className="italic font-normal">Utah</span>
        </span>
        <span
          className={`text-[9.5px] tracking-[0.2em] uppercase opacity-65 mt-3 ${colorClass}`}
        >
          Connections Hub
        </span>
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
type AvatarTone = "blue" | "cream" | "copper";
interface AvatarProps {
  name: string;
  size?: number;
  tone?: AvatarTone;
}

export function Avatar({ name, size = 44, tone = "blue" }: AvatarProps) {
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const tones: Record<AvatarTone, { bg: string; fg: string }> = {
    blue: { bg: "var(--nucleus-blue)", fg: "var(--wasatch-whisper)" },
    cream: { bg: "var(--wasatch-whisper)", fg: "var(--nucleus-blue)" },
    copper: { bg: "var(--copper)", fg: "var(--white)" },
  };
  const t = tones[tone];
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-display font-medium tracking-[-0.01em]"
      style={{
        width: size,
        height: size,
        background: t.bg,
        color: t.fg,
        fontSize: size * 0.42,
        border: tone === "cream" ? "1px solid var(--whisper-300)" : "none",
      }}
    >
      {initials || "·"}
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────────────────
type PillTone = "default" | "blue" | "copper" | "solid";
interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  icon?: ReactNode;
}

export function Pill({ children, tone = "default", icon = null }: PillProps) {
  const cls =
    tone === "blue"
      ? "pill pill-blue"
      : tone === "copper"
        ? "pill pill-copper"
        : tone === "solid"
          ? "pill pill-solid"
          : "pill";
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}

// ── Score arc ─────────────────────────────────────────────────────────────────
interface ScoreArcProps {
  score: number;
  size?: number;
  label?: boolean;
}

export function ScoreArc({ score, size = 72, label = true }: ScoreArcProps) {
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const C = Math.PI * r;
  const dash = C * Math.max(0, Math.min(1, score));
  const color =
    score >= 0.7
      ? "var(--copper)"
      : score >= 0.4
        ? "var(--nucleus-blue-500)"
        : "var(--slate-light)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--whisper-200)" strokeWidth="6" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dash} ${C}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-[600ms] ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-display font-medium text-nucleus-blue"
          style={{ fontSize: size * 0.32 }}
        >
          {Math.round(score * 100)}
        </span>
        {label && (
          <span className="text-[9px] tracking-[0.14em] text-graphite-muted mt-2">
            FIT
          </span>
        )}
      </div>
    </div>
  );
}

// ── Dimension bars ────────────────────────────────────────────────────────────
// The backend only emits dimensions that have non-zero weight for the talent's
// role_category — e.g., a mentor's dimension_scores has only {sector, mission}.
// We render exactly what came back, in a canonical order, so the card honestly
// reflects which dimensions actually scored this match.
interface DimensionBarsProps {
  dims?: DimensionScores;
}

type DimKey = keyof DimensionScores;

const DIM_ORDER: DimKey[] = [
  "sector",
  "role",
  "skills",
  "stage",
  "mission",
  "location",
  "risk",
];
const DIM_LABEL: Record<DimKey, string> = {
  sector: "Sector",
  role: "Role",
  skills: "Skills",
  stage: "Stage",
  mission: "Mission",
  location: "Location",
  risk: "Risk fit",
};

export function DimensionBars({ dims }: DimensionBarsProps) {
  const present = DIM_ORDER.filter((k) => dims?.[k] !== undefined);
  if (present.length === 0) {
    return (
      <div className="text-[11px] text-graphite-light italic">
        No dimension breakdown available.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6 w-full">
      {present.map((k) => {
        const v = Math.max(0, Math.min(1, dims?.[k] ?? 0));
        const barColor =
          v >= 0.7 ? "bg-gold" : v >= 0.4 ? "bg-blue-600" : "bg-pearl-300";
        return (
          <div
            key={k}
            className="grid grid-cols-[68px_1fr_28px] items-center gap-8"
          >
            <span className="text-[11px] text-graphite-muted">{DIM_LABEL[k]}</span>
            <div className="h-6 bg-pearl-200 rounded-[3px] overflow-hidden">
              <div
                className={`h-full transition-[width] duration-500 ease-in-out ${barColor}`}
                style={{ width: `${v * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] text-right text-graphite-muted">
              {(v * 100).toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Sidesheet ─────────────────────────────────────────────────────────────────
interface SidesheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  accent?: "blue" | "copper";
}

export function Sidesheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  accent = "blue",
}: SidesheetProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(15,44,79,0.35)] z-70 flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in w-560 max-w-[94vw] bg-pearl h-full overflow-y-auto border-l border-pearl-300"
      >
        <div
          className={`py-22 px-28 pb-16 border-b border-pearl-300 sticky top-0 bg-pearl z-1 border-t-3 ${
            accent === "copper" ? "border-t-gold" : "border-t-nucleus-blue"
          }`}
        >
          {subtitle && <div className="tiny-caps">{subtitle}</div>}
          <div className="flex items-center justify-between gap-12">
            <h2 className="font-display text-[30px] mt-4 mb-0 text-nucleus-blue">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="btn btn-ghost py-6 px-12 text-[12px]"
            >
              Close ✕
            </button>
          </div>
        </div>
        <div className="pt-24 px-28 pb-48">{children}</div>
      </div>
    </div>
  );
}

// ── Detail group + stat (used by detail bodies) ───────────────────────────────
export function DetailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="tiny-caps mb-8">
        {label}
      </div>
      {children}
    </div>
  );
}

export function Stat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="bg-white border border-pearl-200 rounded-[8px] py-10 px-12">
      <div className="tiny-caps">{k}</div>
      <div className="font-display text-[18px] text-nucleus-blue mt-2">
        {v}
      </div>
    </div>
  );
}

// ── Field (form helper) ───────────────────────────────────────────────────────
export const selectClass = "w-full py-9 px-12 rounded-[6px] border border-pearl-300 bg-white text-[13px] text-graphite";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-14">
      <label className="block text-[12px] font-medium text-graphite mb-6">
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-[11px] text-graphite-light mt-4">{hint}</div>
      )}
    </div>
  );
}

// ── Export modal ─────────────────────────────────────────────────────────────
interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onCsv: () => void;
  onPdf: () => void;
}

export function ExportModal({ open, onClose, onCsv, onPdf }: ExportModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(15,44,79,0.35)] z-70 flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in bg-white rounded-[12px] shadow-[0_16px_48px_rgba(0,0,0,0.18)] w-[420px] max-w-[92vw] overflow-hidden"
      >
        <div className="py-20 px-24 border-b border-pearl-200">
          <h3 className="font-display text-[20px] text-nucleus-blue m-0">
            Export Data
          </h3>
          <p className="text-[13px] text-graphite-muted mt-4 mb-0">
            Download all people and startups data.
          </p>
        </div>
        <div className="p-24 flex gap-12">
          <button
            onClick={() => { onCsv(); onClose(); }}
            className="flex-1 py-16 px-16 rounded-[8px] border border-solid border-pearl-300 bg-pearl cursor-pointer transition-all duration-150 hover:border-nucleus-blue hover:bg-blue-50 text-left group"
          >
            <div className="flex items-center gap-10 mb-6">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="var(--nucleus-blue)" strokeWidth="1.5" fill="none" />
                <path d="M6 7h8M6 10h8M6 13h5" stroke="var(--nucleus-blue)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="font-display font-medium text-[15px] text-graphite">CSV</span>
            </div>
            <span className="text-[12px] text-graphite-muted">
              Spreadsheet-compatible. Opens in Excel, Sheets, etc.
            </span>
          </button>
          <button
            onClick={() => { onPdf(); onClose(); }}
            className="flex-1 py-16 px-16 rounded-[8px] border border-solid border-pearl-300 bg-pearl cursor-pointer transition-all duration-150 hover:border-nucleus-blue hover:bg-blue-50 text-left group"
          >
            <div className="flex items-center gap-10 mb-6">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="var(--nucleus-blue)" strokeWidth="1.5" fill="none" />
                <path d="M6 6h4l4 4v6H6V6z" stroke="var(--nucleus-blue)" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
                <path d="M10 6v4h4" stroke="var(--nucleus-blue)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="font-display font-medium text-[15px] text-graphite">PDF</span>
            </div>
            <span className="text-[12px] text-graphite-muted">
              Formatted document. Ready to share or print.
            </span>
          </button>
        </div>
        <div className="px-24 pb-20 flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-ghost py-6 px-14 text-[12px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generic clickable card-row helper for the keyboard handler pattern ────────
export function cardKeyHandler(onClick?: () => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };
}
