import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Person, Startup } from "../types";
import { NETWORK_LABEL, SECTOR_LABEL, STAGE_LABEL } from "../labels";

// Deterministic gradient/pattern tied to id, so each profile feels different.
function cardArt(seed = ""): [string, string, string] {
  const palettes: Array<[string, string, string]> = [
    ["#0F2C4F", "#1F4F8A", "#F0E8D6"],
    ["#7A4A2C", "#B25438", "#F0E8D6"],
    ["#2D4A3A", "#5C7A5C", "#F0E8D6"],
    ["#0F2C4F", "#9B7B3F", "#F0E8D6"],
    ["#3A2A1F", "#B25438", "#F0E8D6"],
    ["#1F4F8A", "#6FA0CF", "#F0E8D6"],
    ["#7A4A2C", "#9B7B3F", "#F0E8D6"],
    ["#2D4A3A", "#9B7B3F", "#F0E8D6"],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length] as [string, string, string];
}

interface CardHeroProps {
  name: string;
  sectorLabel: string;
  isStartup?: boolean;
}

function CardHero({ name, sectorLabel, isStartup = false }: CardHeroProps) {
  const [a, b, c] = cardArt(name);
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="relative h-[58%] w-full overflow-hidden flex items-end justify-start"
      style={{ background: `linear-gradient(155deg, ${a} 0%, ${b} 80%)` }}
    >
      <svg
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        className="absolute inset-0 w-full h-full opacity-[0.18]"
      >
        <path
          d="M 0 200 L 60 130 L 110 165 L 175 95 L 230 145 L 295 70 L 360 140 L 400 110 L 400 240 L 0 240 Z"
          fill={c}
        />
        <path
          d="M 0 240 L 50 195 L 110 215 L 180 175 L 240 215 L 310 175 L 380 220 L 400 200 L 400 240 Z"
          fill={c}
          opacity="0.55"
        />
      </svg>

      <span
        className="absolute right-[-12px] top-[-30px] text-[280px] font-display font-light tracking-[-0.04em] leading-[1] select-none pointer-events-none text-[rgba(240,232,214,0.10)]"
      >
        {initials}
      </span>

      <svg
        width="100%"
        height="100%"
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        aria-hidden
      >
        <defs>
          <pattern
            id={`grain-${initials}`}
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.4)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grain-${initials})`} />
      </svg>

      <div className="relative mb-24 ml-28 flex items-center gap-14">
        <div
          className={`w-64 h-64 ${isStartup ? "rounded-[14px]" : "rounded-full"} flex items-center justify-center font-display ${isStartup ? "text-[30px]" : "text-[28px]"} font-medium tracking-[-0.02em] bg-[rgba(240,232,214,0.95)]`}
          style={{ color: a }}
        >
          {initials}
        </div>
        <div
          className="py-5 px-11 rounded-full text-[11px] tracking-[0.06em] uppercase bg-[rgba(240,232,214,0.16)] border border-[rgba(240,232,214,0.28)] text-[#F0E8D6]"
        >
          {sectorLabel}
        </div>
      </div>

      <div
        className="absolute left-0 right-0 bottom-0 h-90 bg-[linear-gradient(to_top,rgba(15,44,79,0.4),transparent)]"
      />
    </div>
  );
}

interface PromptChipProps {
  label: string;
  value: string;
  tone?: "blue" | "copper" | "sand";
  wide?: boolean;
}

function PromptChip({ label, value, tone = "blue", wide = false }: PromptChipProps) {
  const bgClass = tone === "copper" ? "bg-[#FBEFE8]" : tone === "sand" ? "bg-[#F5EEDE]" : "bg-[#EAF1F8]";
  const fgClass = tone === "copper" ? "text-gold" : tone === "sand" ? "text-graphite" : "text-nucleus-blue";
  return (
    <div
      className={`${wide ? "col-span-full" : ""} py-8 px-12 rounded-[10px] flex flex-col gap-2 min-w-0 ${bgClass}`}
    >
      <span
        className={`text-[9.5px] tracking-[0.10em] uppercase font-semibold opacity-70 ${fgClass}`}
      >
        {label}
      </span>
      <span
        className={`text-[13px] text-graphite whitespace-nowrap overflow-hidden text-ellipsis ${wide ? "" : "capitalize"}`}
      >
        {value}
      </span>
    </div>
  );
}

function PersonSwipeCard({ p, onTap }: { p: Person; onTap: () => void }) {
  const sector = p.sectors_of_interest[0] ? SECTOR_LABEL[p.sectors_of_interest[0]] : "—";
  const network = NETWORK_LABEL[p.primary_network];
  const looking = p.role_titles_seeking
    .map((r) => r.replace(/_/g, " "))
    .slice(0, 2)
    .join(" · ");
  const mission = (p.mission_keywords ?? [])[0];

  return (
    <div
      onClick={onTap}
      className="w-full h-full rounded-[24px] overflow-hidden bg-white flex flex-col cursor-pointer select-none shadow-[0_24px_60px_rgba(15,44,79,0.20),0_4px_12px_rgba(15,44,79,0.10)]"
    >
      <CardHero name={p.name} sectorLabel={sector} />

      <div className="pt-18 px-22 pb-16 flex-1 flex flex-col gap-10">
        <div>
          <div className="flex items-baseline gap-10 flex-wrap">
            <h2 className="font-display m-0 text-[28px] font-medium tracking-[-0.012em] text-graphite leading-[1.05]">
              {p.name}
            </h2>
            <span className="text-[13px] text-graphite-muted">
              {p.years_experience}y · {p.location_city}
            </span>
          </div>
          <div className="text-[13.5px] text-graphite-muted mt-4 leading-[1.4]">
            {p.headline}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-2">
          <PromptChip label="Looking for" value={looking || "—"} tone="blue" />
          <PromptChip
            label="Network"
            value={network.replace(" Network", "")}
            tone="copper"
          />
        </div>
        {mission && <PromptChip label="Mission" value={mission} tone="sand" wide />}

        <div className="flex flex-wrap gap-5 mt-auto">
          {(p.trust_badges ?? []).slice(0, 3).map((b) => (
            <span
              key={b}
              className="text-[10.5px] py-3 px-9 rounded-full bg-pearl-200 text-graphite border border-pearl-300 tracking-[0.02em]"
            >
              {b}
            </span>
          ))}
          <span className="flex-1" />
          <span className="text-[11px] text-graphite-light self-center">
            Tap to read more →
          </span>
        </div>
      </div>
    </div>
  );
}

function StartupSwipeCard({ s, onTap }: { s: Startup; onTap: () => void }) {
  const sector = SECTOR_LABEL[s.sector];
  const stage = STAGE_LABEL[s.stage];
  const need = s.roles_needed
    .slice(0, 2)
    .map((r) => r.replace(/_/g, " "))
    .join(" · ");

  return (
    <div
      onClick={onTap}
      className="w-full h-full rounded-[24px] overflow-hidden bg-white flex flex-col cursor-pointer select-none shadow-[0_24px_60px_rgba(15,44,79,0.20),0_4px_12px_rgba(15,44,79,0.10)]"
    >
      <CardHero name={s.name} sectorLabel={sector} isStartup />

      <div className="pt-18 px-22 pb-16 flex-1 flex flex-col gap-10">
        <div>
          <div className="flex items-baseline gap-10 flex-wrap">
            <h2 className="font-display m-0 text-[28px] font-medium tracking-[-0.012em] text-graphite leading-[1.05]">
              {s.name}
            </h2>
            <span className="text-[13px] text-graphite-muted">
              {stage} · {s.location_city}
            </span>
          </div>
          <div className="text-[13.5px] text-graphite-muted mt-4 leading-[1.4]">
            {s.one_liner}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <PromptChip label="Hiring" value={need || "—"} tone="copper" />
          <PromptChip label="Team" value={`${s.team_size} people`} tone="blue" />
        </div>
        {s.mission_keywords?.[0] && (
          <PromptChip label="Mission" value={s.mission_keywords[0]} tone="sand" wide />
        )}

        <div className="flex flex-wrap gap-5 mt-auto">
          {(s.trust_badges ?? []).slice(0, 3).map((b) => (
            <span
              key={b}
              className="text-[10.5px] py-3 px-9 rounded-full bg-pearl-200 text-graphite border border-pearl-300 tracking-[0.02em]"
            >
              {b}
            </span>
          ))}
          <span className="flex-1" />
          <span className="text-[11px] text-graphite-light self-center">
            Tap to read more →
          </span>
        </div>
      </div>
    </div>
  );
}

interface CircleActionProps {
  children: ReactNode;
  label: string;
  tone?: "clay" | "blue" | "sage";
  onClick: () => void;
  small?: boolean;
}

function CircleAction({ children, label, tone = "blue", onClick, small = false }: CircleActionProps) {
  const colorMap = {
    clay: "#DC2626",
    blue: "var(--nucleus-blue)",
    sage: "var(--sage)",
  } as const;
  const ringMap = {
    clay: "rgba(220,38,38,0.25)",
    blue: "rgba(15,44,79,0.20)",
    sage: "rgba(45,74,58,0.25)",
  } as const;
  const size = small ? 48 : 60;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-full bg-white flex items-center justify-center cursor-pointer transition-transform duration-[120ms] shadow-[0_4px_12px_rgba(15,44,79,0.12),0_1px_3px_rgba(15,44,79,0.08)] hover:-translate-y-2"
      style={{
        width: size,
        height: size,
        color: colorMap[tone],
        border: `1.5px solid ${ringMap[tone]}`,
      }}
    >
      {children}
    </button>
  );
}

// ── The deck itself ──────────────────────────────────────────────────────────
type DeckKind = "person" | "startup";

interface SwipeDeckProps {
  items: Array<Person | Startup>;
  kind: DeckKind;
  onView?: (item: Person | Startup) => void;
  onConnect?: (item: Person | Startup) => void;
  onPass?: (item: Person | Startup) => void;
  connectedIds?: Set<string>;
  passedIds?: Set<string>;
  emptyText?: string;
  onComplete?: () => void;
}

export function SwipeDeck({
  items,
  kind,
  onView,
  onConnect,
  onPass,
  connectedIds,
  passedIds,
  emptyText,
  onComplete,
}: SwipeDeckProps) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [exit, setExit] = useState<"left" | "right" | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    setIdx(0);
    setDrag({ x: 0, y: 0 });
    setExit(null);
  }, [items]);

  const top = items[idx];
  const next1 = items[idx + 1];
  const next2 = items[idx + 2];

  const commit = useCallback(
    (dir: "left" | "right") => {
      if (!top || exit) return;
      setExit(dir);
      if (dir === "right") onConnect?.(top);
      else onPass?.(top);
      const isLast = idx === items.length - 1;
      setTimeout(() => {
        setIdx((i) => i + 1);
        setDrag({ x: 0, y: 0 });
        setExit(null);
        if (isLast) onComplete?.();
      }, 280);
    },
    [top, exit, onConnect, onPass, idx, items.length, onComplete],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (exit) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || exit) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    setDrag({ x: dx, y: dy });
  };
  const onPointerUp = () => {
    if (!startRef.current) return;
    startRef.current = null;
    if (!movedRef.current && top) {
      onView?.(top);
    } else if (Math.abs(drag.x) > 110) {
      commit(drag.x > 0 ? "right" : "left");
    } else {
      setDrag({ x: 0, y: 0 });
    }
  };

  const handleTap = (item: Person | Startup) => () => {
    if (movedRef.current) return;
    onView?.(item);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") commit("left");
      if (e.key === "ArrowRight") commit("right");
      if (e.key === "Enter" && top) onView?.(top);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, top, onView]);

  if (!top) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center text-graphite-muted text-center gap-14">
        <div className="font-display text-[32px] text-nucleus-blue">
          You've reached the end.
        </div>
        <div className="text-[14px]">
          {emptyText ?? "No more profiles match those filters."}
        </div>
        <button className="btn btn-ghost" onClick={() => setIdx(0)}>
          Start over
        </button>
      </div>
    );
  }

  const rot = drag.x / 18;
  const dragOpacity = Math.min(1, Math.abs(drag.x) / 110);
  const goingRight = drag.x > 0;

  let topTransform: string;
  let topTransition: string;
  if (exit === "right") {
    topTransform = `translate(640px, ${drag.y - 40}px) rotate(28deg)`;
    topTransition = "transform 0.28s cubic-bezier(.2,.7,.2,1), opacity 0.28s";
  } else if (exit === "left") {
    topTransform = `translate(-640px, ${drag.y - 40}px) rotate(-28deg)`;
    topTransition = "transform 0.28s cubic-bezier(.2,.7,.2,1), opacity 0.28s";
  } else {
    topTransform = `translate(${drag.x}px, ${drag.y * 0.4}px) rotate(${rot}deg)`;
    topTransition = startRef.current
      ? "none"
      : "transform 0.22s cubic-bezier(.2,.7,.2,1)";
  }

  const renderCard = (item: Person | Startup) =>
    kind === "startup" ? (
      <StartupSwipeCard s={item as Startup} onTap={handleTap(item)} />
    ) : (
      <PersonSwipeCard p={item as Person} onTap={handleTap(item)} />
    );

  return (
    <div className="flex flex-col items-center gap-18">
      <div className="relative w-[min(420px,92vw)] h-[620px] perspective-[1200px]">
        {next2 && (
          <div
            key={`bg2-${next2.id}`}
            className="absolute inset-0 pointer-events-none transition-[transform,opacity] duration-[280ms]"
            style={{
              transform: exit ? "translateY(10px) scale(0.96)" : "translateY(20px) scale(0.92)",
              opacity: exit ? 0.85 : 0.5,
            }}
          >
            {renderCard(next2)}
          </div>
        )}
        {next1 && (
          <div
            key={`bg1-${next1.id}`}
            className="absolute inset-0 pointer-events-none transition-[transform,opacity] duration-[280ms]"
            style={{
              transform: exit ? "translateY(0) scale(1)" : "translateY(10px) scale(0.96)",
              opacity: exit ? 1 : 0.85,
            }}
          >
            {renderCard(next1)}
          </div>
        )}
        <div
          key={top.id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0 touch-none"
          style={{
            transform: topTransform,
            transition: topTransition,
            opacity: exit ? 0 : 1,
          }}
        >
          {renderCard(top)}

          <div
            className="absolute top-38 left-28 py-8 px-16 rounded-[8px] pointer-events-none font-display text-[30px] italic tracking-[0.02em]"
            style={{
              border: "3px solid var(--clay)",
              color: "var(--clay)",
              background: "rgba(178,84,56,0.08)",
              transform: `rotate(-12deg) scale(${!goingRight ? dragOpacity : 0})`,
              opacity: !goingRight ? dragOpacity : 0,
              transition: startRef.current ? "none" : "opacity 0.2s, transform 0.2s",
            }}
          >
            Pass
          </div>
          <div
            className="absolute top-38 right-28 py-8 px-16 rounded-[8px] pointer-events-none font-display text-[30px] italic tracking-[0.02em]"
            style={{
              border: "3px solid var(--sage)",
              color: "var(--sage)",
              background: "rgba(45,74,58,0.08)",
              transform: `rotate(12deg) scale(${goingRight ? dragOpacity : 0})`,
              opacity: goingRight ? dragOpacity : 0,
              transition: startRef.current ? "none" : "opacity 0.2s, transform 0.2s",
            }}
          >
            Connect
          </div>
        </div>
      </div>

      <div className="flex gap-18 items-center">
        <CircleAction label="Pass" tone="clay" onClick={() => commit("left")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </CircleAction>
        <CircleAction label="View" tone="blue" onClick={() => onView?.(top)} small>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 4v12 M12 20h.01" />
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
          </svg>
        </CircleAction>
        <CircleAction label="Connect" tone="sage" onClick={() => commit("right")}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </CircleAction>
      </div>

      <div className="flex flex-col items-center gap-6 mt-4">
        <div className="text-[11px] text-graphite-muted tracking-[0.04em]">
          {idx + 1} of {items.length}
        </div>
        <div className="text-[10.5px] text-graphite-light">
          ← pass · → connect · ↵ details
        </div>
      </div>
    </div>
  );
}
