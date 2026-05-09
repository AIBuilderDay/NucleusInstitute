import type { ConnectionEdge, Person } from "../types";

interface ConnectionWebProps {
  connections: ConnectionEdge[];
  currentUser: Person;
  onPick: (p: Person) => void;
}

export function ConnectionWeb({ connections, currentUser, onPick }: ConnectionWebProps) {
  const top = connections.slice(0, 14);
  const W = 640,
    H = 480,
    cx = W / 2,
    cy = H / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[560px]">
      {[0.85, 0.6, 0.35].map((_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={70 + i * 70}
          fill="none"
          stroke="var(--whisper-300)"
          strokeDasharray="3 5"
          strokeWidth="1"
          opacity="0.7"
        />
      ))}
      {top.map((c, i) => {
        const a = (i / top.length) * Math.PI * 2 - Math.PI / 2;
        const radius = 70 + (1 - c.warmth) * 140;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        const stroke =
          c.warmth >= 0.6
            ? "var(--copper)"
            : c.warmth >= 0.35
              ? "var(--nucleus-blue-400)"
              : "var(--whisper-300)";
        return (
          <line
            key={`l${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={stroke}
            strokeWidth={Math.max(0.6, c.warmth * 2.2)}
            opacity="0.85"
          />
        );
      })}
      {top.map((c, i) => {
        const a = (i / top.length) * Math.PI * 2 - Math.PI / 2;
        const radius = 70 + (1 - c.warmth) * 140;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        const initials = c.person.name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join("");
        const tx = cx + Math.cos(a) * (radius + 18);
        const ty = cy + Math.sin(a) * (radius + 18);
        const anchor =
          Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle";
        return (
          <g key={`n${i}`} className="cursor-pointer" onClick={() => onPick(c.person)}>
            <circle
              cx={x}
              cy={y}
              r={20}
              fill="var(--wasatch-whisper)"
              stroke="var(--nucleus-blue)"
              strokeWidth="1.5"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontFamily='"Newsreader", serif'
              fontSize="13"
              fill="var(--nucleus-blue)"
            >
              {initials}
            </text>
            <text
              x={tx}
              y={ty}
              textAnchor={anchor}
              fontSize="10.5"
              fill="var(--slate)"
              dominantBaseline="middle"
              fontFamily="var(--font-sans)"
            >
              {c.person.name.split(" ")[0]} · {Math.round(c.warmth * 100)}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={30} fill="var(--nucleus-blue)" />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontFamily='"Newsreader", serif'
        fontSize="20"
        fill="var(--wasatch-whisper)"
      >
        {currentUser.name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("") || "·"}
      </text>
    </svg>
  );
}
