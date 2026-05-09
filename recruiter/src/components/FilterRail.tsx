import { useState } from "react";

export interface RecruiterFilters {
  // Sectors of interest the agent should target — defaults to AI + software
  sectors: string[];
  // Free-text skill chips — turned into skills_any
  skills: string[];
  // Salary ceiling — drops anyone with comp_min above this
  compCeiling: number | null;
  // US state code (e.g. "UT") — empty string means any
  locationState: string;
  // Remote-only toggle
  remoteOnly: boolean;
  // Stage prefs the candidate would consider
  stages: string[];
  // Include students/interns alongside operators
  includeStudents: boolean;
}

const SECTOR_OPTIONS: { value: string; label: string }[] = [
  { value: "ai", label: "AI / ML" },
  { value: "software", label: "Software" },
  { value: "cyber", label: "Cyber" },
  { value: "fintech", label: "Fintech" },
  { value: "life_sciences", label: "Life Sciences" },
  { value: "defense_aerospace", label: "Defense / Aero" },
  { value: "energy", label: "Energy" },
  { value: "advanced_manufacturing", label: "Advanced Mfg" },
];

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "growth", label: "Growth" },
];

interface Props {
  value: RecruiterFilters;
  onChange: (next: RecruiterFilters) => void;
}

export function FilterRail({ value, onChange }: Props) {
  const [skillInput, setSkillInput] = useState("");

  function toggle<T extends string>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  function addSkill() {
    const cleaned = skillInput.trim().toLowerCase();
    if (!cleaned || value.skills.includes(cleaned)) {
      setSkillInput("");
      return;
    }
    onChange({ ...value, skills: [...value.skills, cleaned] });
    setSkillInput("");
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col gap-5 border-r border-slate-800 bg-slate-950/40 px-5 py-6 overflow-y-auto">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Sidebar = structured filters
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          The agent uses these every run. Save when you change them.
        </p>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">Sector focus</div>
        <div className="flex flex-wrap gap-1.5">
          {SECTOR_OPTIONS.map((s) => {
            const on = value.sectors.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => onChange({ ...value, sectors: toggle(value.sectors, s.value) })}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  on
                    ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40"
                    : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">Required skills</div>
        <div className="flex gap-2">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
            placeholder="e.g. python, pytorch"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
          <button
            onClick={addSkill}
            className="rounded-md bg-slate-800 px-2.5 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
          >
            +
          </button>
        </div>
        {value.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.skills.map((s) => (
              <span
                key={s}
                className="group flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200 ring-1 ring-emerald-400/30"
              >
                {s}
                <button
                  onClick={() => onChange({ ...value, skills: value.skills.filter((x) => x !== s) })}
                  className="opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">Comp ceiling</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">$</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 180000"
            value={value.compCeiling ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                compCeiling: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Drops candidates whose minimum salary expectation exceeds this.
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">Location</div>
        <input
          value={value.locationState}
          onChange={(e) => onChange({ ...value, locationState: e.target.value.toUpperCase().slice(0, 2) })}
          placeholder="UT"
          className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm uppercase placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
        <label className="ml-3 inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={value.remoteOnly}
            onChange={(e) => onChange({ ...value, remoteOnly: e.target.checked })}
            className="size-3.5 accent-indigo-400"
          />
          Remote OK
        </label>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">Stage tolerance</div>
        <div className="flex flex-wrap gap-1.5">
          {STAGE_OPTIONS.map((s) => {
            const on = value.stages.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => onChange({ ...value, stages: toggle(value.stages, s.value) })}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  on
                    ? "bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-400/40"
                    : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={value.includeStudents}
          onChange={(e) => onChange({ ...value, includeStudents: e.target.checked })}
          className="size-3.5 accent-indigo-400"
        />
        Include students / interns
      </label>
    </aside>
  );
}
