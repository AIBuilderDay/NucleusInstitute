import { useMemo, useState } from "react";
import type { Person, RoleCategory } from "../types";
import { ROLE_CATEGORY_LABEL } from "../labels";
import { normalizePersonTopology } from "./normalizer";
import { computeArchetypes } from "./archetypes";
import { TopologyScene } from "./TopologyScene";
import { DIMENSION_ORDER, DIMENSION_LABELS } from "./types";

const ROLE_CATEGORIES: RoleCategory[] = [
  "executive",
  "operator",
  "mentor",
  "advisor",
  "investor",
  "service_provider",
  "student",
  "intern",
  "board_member",
  "university",
];

type CompareMode = "none" | "person" | "archetype";

interface TopologyPageProps {
  people: Person[];
  currentUser: Person;
}

const selectClass =
  "w-full py-8 px-10 text-[13px] text-graphite bg-white border border-solid border-pearl-300 rounded-[6px] outline-none";

function DimBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-8">
      <span className="text-[11px] text-graphite-muted w-56 shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 h-6 bg-pearl-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-mono text-graphite-muted w-32 shrink-0">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function Legend() {
  const items = [
    { color: "#0848b8", label: "Primary" },
    { color: "#dc2626", label: "Comparison" },
  ];
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-4">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-4">
          <div
            className="w-8 h-8 rounded-full shrink-0"
            style={{ background: it.color }}
          />
          <span className="text-[10px] text-graphite-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TopologyPage({ people, currentUser }: TopologyPageProps) {
  const [selectedId, setSelectedId] = useState(currentUser.id);
  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [comparePersonId, setComparePersonId] = useState<string>(
    people.find((p) => p.id !== currentUser.id)?.id ?? currentUser.id,
  );
  const [compareArchetype, setCompareArchetype] =
    useState<RoleCategory>("executive");
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);

  const selectedPerson = people.find((p) => p.id === selectedId) ?? currentUser;
  const comparePerson = people.find((p) => p.id === comparePersonId);

  const archetypes = useMemo(() => computeArchetypes(people), [people]);

  const primaryScores = useMemo(
    () => normalizePersonTopology(selectedPerson),
    [selectedPerson],
  );

  const secondaryScores = useMemo(() => {
    if (compareMode === "person" && comparePerson)
      return normalizePersonTopology(comparePerson);
    if (compareMode === "archetype") return archetypes[compareArchetype];
    return undefined;
  }, [compareMode, comparePerson, compareArchetype, archetypes]);

  return (
    <div className="grid grid-cols-[340px_1fr] min-h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="border-r border-solid border-pearl-200 p-20 flex flex-col gap-20 overflow-y-auto">
        <div>
          <h2 className="font-display text-[20px] text-graphite m-0 mb-4">
            Topology
          </h2>
          <p className="text-[12px] text-graphite-muted m-0">
            3D semantic terrain of profile dimensions
          </p>
        </div>

        {/* User picker */}
        <div className="flex flex-col gap-6">
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light">
            Profile
          </label>
          <select
            className={selectClass}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {ROLE_CATEGORY_LABEL[p.role_category] ?? p.role_category}
              </option>
            ))}
          </select>
        </div>

        {/* Compare */}
        <div className="flex flex-col gap-6">
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light">
            Compare Against
          </label>
          <div className="flex gap-4">
            {(["none", "person", "archetype"] as CompareMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setCompareMode(m)}
                className={`flex-1 py-6 px-8 text-[11px] border border-solid rounded-[5px] cursor-pointer transition-colors ${
                  compareMode === m
                    ? "bg-nucleus-blue text-white border-nucleus-blue"
                    : "bg-white text-graphite-muted border-pearl-300"
                }`}
              >
                {m === "none" ? "Off" : m === "person" ? "Person" : "Archetype"}
              </button>
            ))}
          </div>

          {compareMode === "person" && (
            <select
              className={selectClass}
              value={comparePersonId}
              onChange={(e) => setComparePersonId(e.target.value)}
            >
              {people
                .filter((p) => p.id !== selectedId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}

          {compareMode === "archetype" && (
            <select
              className={selectClass}
              value={compareArchetype}
              onChange={(e) =>
                setCompareArchetype(e.target.value as RoleCategory)
              }
            >
              {ROLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {ROLE_CATEGORY_LABEL[cat] ?? cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-6">
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light">
            Display
          </label>
          <label className="flex items-center gap-8 text-[12px] text-graphite cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Dimension labels
          </label>
          <label className="flex items-center gap-8 text-[12px] text-graphite cursor-pointer">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            Auto-rotate
          </label>
        </div>

        {/* Dimension breakdown */}
        <div className="flex flex-col gap-6">
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light">
            Dimensions
          </label>
          <div className="flex flex-col gap-6">
            {DIMENSION_ORDER.map((dim) => (
              <DimBar
                key={dim}
                label={DIMENSION_LABELS[dim]}
                value={primaryScores[dim]}
                color="#0848b8"
              />
            ))}
          </div>
          {secondaryScores && (
            <>
              <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light mt-8">
                Comparison
              </label>
              <div className="flex flex-col gap-6">
                {DIMENSION_ORDER.map((dim) => (
                  <DimBar
                    key={dim}
                    label={DIMENSION_LABELS[dim]}
                    value={secondaryScores[dim]}
                    color="#dc2626"
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-6">
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-light">
            Legend
          </label>
          <Legend />
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="min-h-[500px] relative">
        <TopologyScene
          primary={primaryScores}
          secondary={secondaryScores}
          showLabels={showLabels}
          comparisonMode={compareMode !== "none"}
          autoRotate={autoRotate}
        />
      </div>
    </div>
  );
}
