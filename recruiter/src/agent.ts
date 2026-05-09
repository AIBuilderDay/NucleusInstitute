// Client for the HEAL autopilot service. Talks to a SEPARATE FastAPI on
// port 8766 — not the matching backend. Override with VITE_AUTOPILOT_URL or
// localStorage["heal-autopilot.url"].

const ENV_BASE = import.meta.env.VITE_AUTOPILOT_URL?.trim();
const FALLBACK_BASE = "http://localhost:8766";

export function resolveAutopilotBase(): string {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("heal-autopilot.url");
    if (stored && stored.trim()) return stored.trim();
  }
  if (ENV_BASE) return ENV_BASE;
  return FALLBACK_BASE;
}

export const AUTOPILOT_BASE = resolveAutopilotBase();

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${AUTOPILOT_BASE}${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    let body = "";
    try { body = await r.text(); } catch { /* ignore */ }
    throw new HttpError(r.status, `${r.status} ${r.statusText} — ${body || url}`);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export interface AgentConfig {
  candidate_criteria: string;
  email_instructions: string;
  structured_filters: Record<string, unknown>;
  schedule_enabled: boolean;
  cadence_hours: number;
  last_run_at: string | null;
  updated_at: string | null;
}

export interface RunLogEntry {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  status: string;
  candidates_considered: number;
  emails_sent: number;
  skipped: number;
  error: string | null;
  notes: string[];
}

export interface HealBrief {
  id: string;
  name: string;
  one_liner: string;
  sector: string;
  stage: string;
  roles_needed: string[];
  required_skills: string[];
  comp_max_salary_usd: number | null;
}

export interface HealthStatus {
  status: string;
  service: string;
  anthropic_configured: boolean;
  nucleus_backend_url: string;
  tick_minutes: number;
}

export const autopilot = {
  base: AUTOPILOT_BASE,

  async ping(): Promise<HealthStatus | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`${AUTOPILOT_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      return (await r.json()) as HealthStatus;
    } catch {
      return null;
    }
  },

  async getConfig(): Promise<AgentConfig> {
    return await request<AgentConfig>("/config");
  },

  async putConfig(payload: Omit<AgentConfig, "last_run_at" | "updated_at">): Promise<AgentConfig> {
    return await request<AgentConfig>("/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async listRuns(limit = 25): Promise<RunLogEntry[]> {
    const r = await request<{ runs: RunLogEntry[] }>(`/runs?limit=${limit}`);
    return r.runs;
  },

  async runNow(): Promise<RunLogEntry & { run_id: number }> {
    return await request(`/run-now`, { method: "POST" });
  },

  async getHeal(): Promise<HealBrief> {
    return await request<HealBrief>("/heal");
  },
};

export { HttpError };
