// Real backend client. All HTTP goes through one base URL (see config.ts).
//
// The backend exposes (under /api/v1):
//   GET  /talent                         → list talents
//   GET  /talent/{id}                    → one talent
//   POST /talent                         → create talent
//   GET  /startup, /startup/{id}, POST /startup
//   POST /match/talent/{id}              → ranked startups for one talent
//   POST /match/startup/{id}             → ranked talents for one startup
//   POST /match/talent/{id}/compare      → side-by-side from every matcher
// And /health (no prefix).

import { API_BASE_URL, API_PREFIX } from "./config";
import type {
  CompareResponse,
  GoogleUserInfo,
  MatchResponse,
  MatchResult,
  OnboardAgentResponse,
  Person,
  PingResult,
  Sector,
  Startup,
} from "./types";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
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
    try {
      body = await r.text();
    } catch {
      /* ignore */
    }
    throw new ApiError(r.status, `${r.status} ${r.statusText} — ${body || url}`);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

// ── Backend response shapes (only what we read) ───────────────────────────────
interface TalentListResponse {
  items: Person[];
  total: number;
}
interface StartupListResponse {
  items: Startup[];
  total: number;
}
interface TalentMatchResponse {
  talent: Person;
  matcher: string;
  matches: MatchResult[];
}
interface StartupMatchResponse {
  startup: Startup;
  matcher: string;
  matches: MatchResult[];
}
interface MatchCompareResponse {
  by_matcher: Record<string, MatchResult[]>;
}

// ── Public client ─────────────────────────────────────────────────────────────
export const api = {
  base: API_BASE_URL,

  async ping(): Promise<PingResult> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`${API_BASE_URL}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return { live: false, url: API_BASE_URL };
      return { live: true, info: await r.json(), url: API_BASE_URL };
    } catch {
      return { live: false, url: API_BASE_URL };
    }
  },

  async listPeople(limit?: number): Promise<Person[]> {
    const qs = limit ? `?limit=${limit}` : "";
    const r = await request<TalentListResponse>(`${API_PREFIX}/talent${qs}`);
    return r.items;
  },

  async listStartups(limit?: number): Promise<Startup[]> {
    const qs = limit ? `?limit=${limit}` : "";
    const r = await request<StartupListResponse>(`${API_PREFIX}/startup${qs}`);
    return r.items;
  },

  async getPerson(id: string): Promise<Person> {
    return await request<Person>(`${API_PREFIX}/talent/${id}`);
  },

  async getStartup(id: string): Promise<Startup> {
    return await request<Startup>(`${API_PREFIX}/startup/${id}`);
  },

  async createPerson(payload: Omit<Person, "id"> & { email: string }): Promise<Person> {
    return await request<Person>(`${API_PREFIX}/talent`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async googleHandoff(token: string): Promise<GoogleUserInfo> {
    return await request<GoogleUserInfo>(
      `${API_PREFIX}/auth/google/handoff?token=${encodeURIComponent(token)}`,
    );
  },

  async onboardAgent(payload: {
    google_userinfo: GoogleUserInfo;
    resume_text?: string;
  }): Promise<OnboardAgentResponse> {
    return await request<OnboardAgentResponse>(`${API_PREFIX}/onboard/agent`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async matchPerson(
    personId: string,
    opts: { topK?: number; sectorFilter?: Sector[]; matcher?: string } = {},
  ): Promise<MatchResponse> {
    const { topK = 10, matcher } = opts;
    const qs = new URLSearchParams({ top_k: String(topK) });
    if (matcher) qs.set("matcher", matcher);
    const r = await request<TalentMatchResponse>(
      `${API_PREFIX}/match/talent/${personId}?${qs.toString()}`,
      { method: "POST" },
    );
    return { source: "live", matches: r.matches, talent: r.talent };
  },

  async matchStartup(
    startupId: string,
    opts: { topK?: number; matcher?: string; roles?: string[] } = {},
  ): Promise<MatchResponse> {
    const { topK = 10, matcher, roles } = opts;
    const qs = new URLSearchParams({ top_k: String(topK) });
    if (matcher) qs.set("matcher", matcher);
    if (roles?.length) for (const r of roles) qs.append("roles", r);
    const r = await request<StartupMatchResponse>(
      `${API_PREFIX}/match/startup/${startupId}?${qs.toString()}`,
      { method: "POST" },
    );
    return { source: "live", matches: r.matches, startup: r.startup };
  },

  async compare(personId: string, opts: { topK?: number } = {}): Promise<CompareResponse> {
    const { topK = 10 } = opts;
    const r = await request<MatchCompareResponse>(
      `${API_PREFIX}/match/talent/${personId}/compare?top_k=${topK}`,
      { method: "POST" },
    );
    return { source: "live", by_matcher: r.by_matcher };
  },

  async compareStartup(startupId: string, opts: { topK?: number } = {}): Promise<CompareResponse> {
    const { topK = 10 } = opts;
    const r = await request<MatchCompareResponse>(
      `${API_PREFIX}/match/startup/${startupId}/compare?top_k=${topK}`,
      { method: "POST" },
    );
    return { source: "live", by_matcher: r.by_matcher };
  },
};

// ── Client-side helpers (no backend call) ─────────────────────────────────────

function intersect<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): T[] {
  const s = new Set(a ?? []);
  return (b ?? []).filter((x) => s.has(x));
}

/**
 * Rough connection web warmth. Computed entirely client-side from the loaded
 * people array — the backend has no notion of "who knows who" yet.
 */
export function connections(personId: string, people: Person[]) {
  const me = people.find((p) => p.id === personId);
  if (!me) return [];
  return people
    .filter((p) => p.id !== personId)
    .map((p) => {
      let w = 0;
      if (intersect(me.sectors_of_interest, p.sectors_of_interest).length) w += 0.35;
      if (intersect(me.university_affiliations, p.university_affiliations).length) w += 0.3;
      if (me.location_city === p.location_city) w += 0.2;
      if (intersect(me.mission_keywords, p.mission_keywords).length) w += 0.15;
      return { person: p, warmth: Math.min(1, w) };
    })
    .filter((x) => x.warmth > 0)
    .sort((a, b) => b.warmth - a.warmth);
}

/** Hydrate `match.startup` / `match.person` from the loaded lists. */
export function hydrateMatches(
  matches: MatchResult[],
  people: Person[],
  startups: Startup[],
): MatchResult[] {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const startupsById = new Map(startups.map((s) => [s.id, s]));
  return matches.map((m) => ({
    ...m,
    startup: m.startup ?? startupsById.get(m.startup_id),
    person: m.person ?? peopleById.get(m.talent_id),
  }));
}

export { ApiError };
