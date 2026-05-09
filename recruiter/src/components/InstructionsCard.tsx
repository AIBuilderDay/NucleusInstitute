import { useEffect, useState } from "react";

interface Props {
  candidateCriteria: string;
  emailInstructions: string;
  scheduleEnabled: boolean;
  cadenceHours: number;
  saving: boolean;
  saved: boolean;
  onChange: (next: {
    candidateCriteria: string;
    emailInstructions: string;
    scheduleEnabled: boolean;
    cadenceHours: number;
  }) => void;
  onSave: () => void;
  onRunNow: () => void;
  running: boolean;
}

const CADENCE_OPTIONS: { hours: number; label: string }[] = [
  { hours: 1, label: "every 1 hour" },
  { hours: 6, label: "every 6 hours" },
  { hours: 12, label: "every 12 hours" },
  { hours: 24, label: "every day" },
  { hours: 24 * 3, label: "every 3 days" },
  { hours: 24 * 7, label: "every week" },
];

export function InstructionsCard({
  candidateCriteria,
  emailInstructions,
  scheduleEnabled,
  cadenceHours,
  saving,
  saved,
  onChange,
  onSave,
  onRunNow,
  running,
}: Props) {
  const [savedFlash, setSavedFlash] = useState(false);
  useEffect(() => {
    if (!saved) return;
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-300/80">
          Agent instructions
        </div>
        <h2 className="mt-1 text-lg font-semibold text-slate-50">
          Tell the agent what to do
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          The sidebar handles structured filters. The two text boxes below
          are free-text — the agent reads them verbatim every time it runs.
        </p>
      </header>

      <Block
        title="Candidate criteria"
        hint="What kind of person should the agent pursue? Be specific. The agent combines this with the sidebar filters."
      >
        <textarea
          rows={5}
          value={candidateCriteria}
          onChange={(e) =>
            onChange({
              candidateCriteria: e.target.value,
              emailInstructions,
              scheduleEnabled,
              cadenceHours,
            })
          }
          placeholder="e.g. Senior+ backend engineers with production LLM experience. Comfortable with FastAPI and Postgres. Bonus for anyone who's shipped agent loops or RAG systems. We don't want anyone who's only worked at FAANG — we need scrappy."
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </Block>

      <Block
        title="Email instructions"
        hint="Tone, length, calls to action, things to mention or avoid. The agent personalizes per candidate but follows your rules verbatim."
      >
        <textarea
          rows={6}
          value={emailInstructions}
          onChange={(e) =>
            onChange({
              candidateCriteria,
              emailInstructions: e.target.value,
              scheduleEnabled,
              cadenceHours,
            })
          }
          placeholder="e.g. Warm, casual tone — no corporate buzzwords. Open with one sentence about why I'm reaching out (be specific to their profile). Mention we're a 4-person seed team in SLC and remote is fine. Always ask for a 20-min intro call. Sign off as 'Nathan'."
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </Block>

      <Block
        title="Schedule"
        hint="When the autopilot is on, the agent fires on this cadence and runs unattended."
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) =>
                onChange({
                  candidateCriteria,
                  emailInstructions,
                  scheduleEnabled: e.target.checked,
                  cadenceHours,
                })
              }
              className="size-4 accent-indigo-400"
            />
            Autopilot on
          </label>

          <select
            disabled={!scheduleEnabled}
            value={cadenceHours}
            onChange={(e) =>
              onChange({
                candidateCriteria,
                emailInstructions,
                scheduleEnabled,
                cadenceHours: Number(e.target.value),
              })
            }
            className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 disabled:opacity-50 focus:border-indigo-400 focus:outline-none"
          >
            {CADENCE_OPTIONS.map((o) => (
              <option key={o.hours} value={o.hours} className="bg-slate-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Block>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-indigo-900/40 transition hover:bg-indigo-400 disabled:cursor-wait disabled:bg-slate-700"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedFlash && (
          <span className="text-xs text-emerald-300">✓ Saved</span>
        )}
        <button
          onClick={onRunNow}
          disabled={running}
          className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-50"
        >
          {running ? "Agent running…" : "Run now"}
        </button>
        <span className="ml-auto text-[11px] text-slate-500">
          Runs are capped at 5 outbound emails per fire.
        </span>
      </div>
    </section>
  );
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-100">{title}</span>
        <span className="text-[11px] text-slate-500">{hint}</span>
      </div>
      {children}
    </div>
  );
}
