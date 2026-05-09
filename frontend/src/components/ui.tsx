import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
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
  const c = inverse ? "var(--white)" : "var(--nucleus-blue)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <IUMonogram
        size={34}
        color={c}
        bg={inverse ? "var(--nucleus-blue)" : "var(--white)"}
      />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          className="display"
          style={{ fontSize: 20.5, fontWeight: 500, color: c, letterSpacing: "-0.012em" }}
        >
          Innovate{" "}
          <span style={{ fontStyle: "italic", fontWeight: 400 }}>Utah</span>
        </span>
        <span
          style={{
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: c,
            opacity: 0.65,
            marginTop: 3,
          }}
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
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: t.bg,
        color: t.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 500,
        fontSize: size * 0.42,
        letterSpacing: "-0.01em",
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
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
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
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        <span
          className="display"
          style={{ fontSize: size * 0.32, fontWeight: 500, color: "var(--nucleus-blue)" }}
        >
          {Math.round(score * 100)}
        </span>
        {label && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "var(--slate)",
              marginTop: 2,
            }}
          >
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
      <div style={{ fontSize: 11, color: "var(--slate-light)", fontStyle: "italic" }}>
        No dimension breakdown available.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, width: "100%" }}>
      {present.map((k) => {
        const v = Math.max(0, Math.min(1, dims?.[k] ?? 0));
        const color =
          v >= 0.7
            ? "var(--copper)"
            : v >= 0.4
              ? "var(--nucleus-blue-500)"
              : "var(--whisper-300)";
        return (
          <div
            key={k}
            style={{
              display: "grid",
              gridTemplateColumns: "68px 1fr 28px",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--slate)" }}>{DIM_LABEL[k]}</span>
            <div
              style={{
                height: 6,
                background: "var(--whisper-200)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${v * 100}%`,
                  height: "100%",
                  background: color,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <span
              className="mono"
              style={{ fontSize: 10.5, textAlign: "right", color: "var(--slate)" }}
            >
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
  const accentColor = accent === "copper" ? "var(--copper)" : "var(--nucleus-blue)";
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,44,79,0.35)",
        zIndex: 70,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          width: 560,
          maxWidth: "94vw",
          background: "var(--whisper-50)",
          height: "100%",
          overflowY: "auto",
          borderLeft: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            padding: "22px 28px 16px",
            borderBottom: "1px solid var(--color-border)",
            borderTop: `3px solid ${accentColor}`,
            position: "sticky",
            top: 0,
            background: "var(--whisper-50)",
            zIndex: 1,
          }}
        >
          {subtitle && <div className="tiny-caps">{subtitle}</div>}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h2
              className="display"
              style={{
                fontSize: 30,
                margin: "4px 0 0",
                color: "var(--nucleus-blue)",
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Close ✕
            </button>
          </div>
        </div>
        <div style={{ padding: "24px 28px 48px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Detail group + stat (used by detail bodies) ───────────────────────────────
export function DetailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="tiny-caps" style={{ marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function Stat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--color-border-soft)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div className="tiny-caps">{k}</div>
      <div
        className="display"
        style={{ fontSize: 18, color: "var(--nucleus-blue)", marginTop: 2 }}
      >
        {v}
      </div>
    </div>
  );
}

// ── Field (form helper) ───────────────────────────────────────────────────────
export const selectStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--white)",
  fontSize: 13,
  color: "var(--charcoal)",
};

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
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--charcoal)",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--slate-light)", marginTop: 4 }}>{hint}</div>
      )}
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
