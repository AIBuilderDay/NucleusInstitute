import type { RunLogEntry } from "../agent";

interface Props {
  runs: RunLogEntry[];
  loading: boolean;
}

export function RunHistoryPanel({ runs, loading }: Props) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Run history
          </div>
          <h2 className="mt-0.5 text-base font-semibold text-slate-100">
            What the agent has done
          </h2>
        </div>
        {loading && <span className="text-[11px] text-slate-500">refreshing…</span>}
      </header>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
          No runs yet. Hit <strong>Run now</strong> above, or flip the schedule on
          and wait for the next tick.
        </div>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RunRow({ run }: { run: RunLogEntry }) {
  const tone =
    run.status === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : run.status === "running"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-rose-500/40 bg-rose-500/10";

  return (
    <li
      className={`rounded-xl border ${tone} px-4 py-3 text-sm`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-xs text-slate-400">{fmtTs(run.started_at)}</span>
        <StatusPill status={run.status} />
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          {run.trigger}
        </span>
        <span className="ml-auto flex gap-3 text-xs text-slate-300">
          <span>
            considered{" "}
            <strong className="text-slate-100">{run.candidates_considered}</strong>
          </span>
          <span>
            sent{" "}
            <strong className="text-emerald-300">{run.emails_sent}</strong>
          </span>
          <span>
            skipped{" "}
            <strong className="text-slate-400">{run.skipped}</strong>
          </span>
        </span>
      </div>

      {run.error && (
        <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200">
          {run.error}
        </div>
      )}

      {run.notes.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
            {run.notes.length} note{run.notes.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-400">
            {run.notes.map((n, i) => (
              <li key={i} className="font-mono leading-snug">
                · {n}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ok: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
    running: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
    error: "bg-rose-500/20 text-rose-200 ring-rose-400/40",
  };
  const tone = cls[status] ?? "bg-slate-700 text-slate-200 ring-slate-500/40";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tone}`}>
      {status}
    </span>
  );
}

function fmtTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
