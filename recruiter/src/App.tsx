import { useEffect, useRef, useState } from "react";
import { autopilot, type AgentConfig, type HealBrief, type HealthStatus, type RunLogEntry } from "./agent";
import { FilterRail, type RecruiterFilters } from "./components/FilterRail";
import { InstructionsCard } from "./components/InstructionsCard";
import { RunHistoryPanel } from "./components/RunHistoryPanel";

const DEFAULT_FILTERS: RecruiterFilters = {
  sectors: ["ai", "software"],
  skills: [],
  compCeiling: null,
  locationState: "",
  remoteOnly: false,
  stages: ["seed", "series_a"],
  includeStudents: true,
};

function structuredFiltersFromUI(f: RecruiterFilters): Record<string, unknown> {
  return {
    sectors: f.sectors,
    skills: f.skills,
    comp_ceiling_usd: f.compCeiling,
    location_state: f.locationState || null,
    remote_only: f.remoteOnly,
    stages: f.stages,
    include_students: f.includeStudents,
  };
}

function uiFromStructuredFilters(s: Record<string, unknown>): RecruiterFilters {
  return {
    sectors: asStringArray(s.sectors) ?? DEFAULT_FILTERS.sectors,
    skills: asStringArray(s.skills) ?? [],
    compCeiling: typeof s.comp_ceiling_usd === "number" ? s.comp_ceiling_usd : null,
    locationState: typeof s.location_state === "string" ? s.location_state : "",
    remoteOnly: Boolean(s.remote_only),
    stages: asStringArray(s.stages) ?? DEFAULT_FILTERS.stages,
    includeStudents: s.include_students !== false,
  };
}

function asStringArray(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}

export function App() {
  const [bootState, setBootState] = useState<"loading" | "online" | "offline">("loading");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [heal, setHeal] = useState<HealBrief | null>(null);
  const [filters, setFilters] = useState<RecruiterFilters>(DEFAULT_FILTERS);
  const [criteria, setCriteria] = useState("");
  const [emailInstructions, setEmailInstructions] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadenceHours, setCadenceHours] = useState(24);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<RunLogEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialMount = useRef(true);

  useEffect(() => {
    let dead = false;
    void (async () => {
      const h = await autopilot.ping();
      if (dead) return;
      if (!h) {
        setBootState("offline");
        return;
      }
      setHealth(h);
      setBootState("online");
      try {
        const [cfg, brief, runList] = await Promise.all([
          autopilot.getConfig(),
          autopilot.getHeal().catch(() => null),
          autopilot.listRuns(),
        ]);
        if (dead) return;
        applyConfig(cfg);
        setHeal(brief);
        setRuns(runList);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Live-poll the run list while a run is in flight (so the user sees progress).
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      try {
        const list = await autopilot.listRuns();
        setRuns(list);
      } catch { /* ignore poll errors */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [running]);

  function applyConfig(cfg: AgentConfig) {
    setCriteria(cfg.candidate_criteria);
    setEmailInstructions(cfg.email_instructions);
    setScheduleEnabled(cfg.schedule_enabled);
    setCadenceHours(cfg.cadence_hours);
    setLastRunAt(cfg.last_run_at);
    if (cfg.structured_filters && Object.keys(cfg.structured_filters).length > 0) {
      setFilters(uiFromStructuredFilters(cfg.structured_filters));
    }
  }

  async function refreshRuns() {
    setRunsLoading(true);
    try {
      const list = await autopilot.listRuns();
      setRuns(list);
    } finally {
      setRunsLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setError(null);
    try {
      const cfg = await autopilot.putConfig({
        candidate_criteria: criteria,
        email_instructions: emailInstructions,
        structured_filters: structuredFiltersFromUI(filters),
        schedule_enabled: scheduleEnabled,
        cadence_hours: cadenceHours,
      });
      applyConfig(cfg);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      // Save first so the agent reads the latest sidebar/instructions.
      await autopilot.putConfig({
        candidate_criteria: criteria,
        email_instructions: emailInstructions,
        structured_filters: structuredFiltersFromUI(filters),
        schedule_enabled: scheduleEnabled,
        cadence_hours: cadenceHours,
      });
      await autopilot.runNow();
      await refreshRuns();
      const cfg = await autopilot.getConfig();
      setLastRunAt(cfg.last_run_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  // Mark the user as having unsaved changes when they edit anything after mount.
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    setSavedAt(0);
  }, [criteria, emailInstructions, scheduleEnabled, cadenceHours, filters]);

  if (bootState === "loading") {
    return <CenterMsg title="Connecting to the autopilot service…" subtitle={autopilot.base} />;
  }
  if (bootState === "offline") {
    return (
      <CenterMsg
        tone="error"
        title="Autopilot service offline"
        subtitle={`Couldn't reach ${autopilot.base}. From the repo root: \`task autopilot:dev\` (and make sure \`task dev\` is also running).`}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white">
            H
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">HEAL Engineering · Hiring Autopilot</div>
            <div className="text-[11px] text-slate-500">
              {heal ? heal.one_liner : "Loading hiring brief…"}
            </div>
          </div>
        </div>
        <HealthBadges health={health} lastRunAt={lastRunAt} scheduleEnabled={scheduleEnabled} />
      </header>

      <main className="flex min-h-0 flex-1">
        <FilterRail value={filters} onChange={setFilters} />

        <section className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {health && !health.anthropic_configured && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <strong>ANTHROPIC_API_KEY is not set</strong> on the autopilot service.
              The agent loop will fail until you add it to <span className="font-mono">autopilot/.env</span>.
            </div>
          )}

          <InstructionsCard
            candidateCriteria={criteria}
            emailInstructions={emailInstructions}
            scheduleEnabled={scheduleEnabled}
            cadenceHours={cadenceHours}
            saving={saving}
            saved={savedAt > 0}
            onChange={({ candidateCriteria, emailInstructions, scheduleEnabled, cadenceHours }) => {
              setCriteria(candidateCriteria);
              setEmailInstructions(emailInstructions);
              setScheduleEnabled(scheduleEnabled);
              setCadenceHours(cadenceHours);
            }}
            onSave={saveConfig}
            onRunNow={runNow}
            running={running}
          />

          <RunHistoryPanel runs={runs} loading={runsLoading} />
        </section>
      </main>
    </div>
  );
}

function HealthBadges({
  health,
  lastRunAt,
  scheduleEnabled,
}: {
  health: HealthStatus | null;
  lastRunAt: string | null;
  scheduleEnabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {scheduleEnabled ? (
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200 ring-1 ring-emerald-400/40">
          <span className="size-1.5 rounded-full bg-emerald-400 pulse-soft" />
          autopilot on · every {formatCadence(health, lastRunAt)}
        </span>
      ) : (
        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400 ring-1 ring-slate-700">
          autopilot off
        </span>
      )}
      <span
        className={`rounded-full px-2.5 py-1 ring-1 ${
          health?.anthropic_configured
            ? "bg-indigo-500/15 text-indigo-200 ring-indigo-400/40"
            : "bg-amber-500/15 text-amber-200 ring-amber-400/40"
        }`}
      >
        {health?.anthropic_configured ? "Sonnet 4.6 ready" : "Sonnet 4.6 — key missing"}
      </span>
    </div>
  );
}

function formatCadence(_health: HealthStatus | null, _lastRunAt: string | null): string {
  // Cadence text is rendered upstream from the schedule selector value, so
  // this helper exists for future expansion (next-fire countdown). For now
  // the badge just shows "on" — InstructionsCard already shows the cadence.
  return "schedule";
}

function CenterMsg({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle?: string;
  tone?: "error";
}) {
  return (
    <div className="grid min-h-screen place-items-center px-8 text-center">
      <div>
        <div
          className={`mx-auto mb-4 size-12 rounded-full ${
            tone === "error" ? "bg-rose-500/20" : "bg-indigo-500/20"
          } pulse-soft`}
        />
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        {subtitle && <div className="mt-2 text-sm text-slate-400">{subtitle}</div>}
      </div>
    </div>
  );
}
