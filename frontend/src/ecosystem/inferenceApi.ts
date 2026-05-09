// Frontend client for the LinkedIn-handoff + interest-inference flow.
// Backend wiring: handoff endpoint already exists (/api/v1/auth/linkedin/handoff);
// inference endpoint is new — POST /api/v1/onboard/infer-interests.
//
// While ANTHROPIC_API_KEY isn't restored, the loader returns a deterministic
// mocked response so the UX works end-to-end.

import { API_BASE_URL, API_PREFIX } from "../config";

export interface LinkedInUserinfo {
  sub: string;
  name: string;
  email: string;
  email_verified?: boolean;
  picture?: string;
  locale?: string;
  given_name?: string;
  family_name?: string;
}

export interface InferredInterests {
  city: string;
  sectors: string[];
  stages: string[];
  lookingFor: ("resources" | "startups" | "both")[];
  evidence: string[];
  confidence: "low" | "medium" | "high";
}

export async function popLinkedInHandoff(token: string): Promise<LinkedInUserinfo> {
  const r = await fetch(
    `${API_BASE_URL}${API_PREFIX}/auth/linkedin/handoff?token=${encodeURIComponent(token)}`,
  );
  if (!r.ok) throw new Error(`Handoff failed: ${r.status}`);
  return (await r.json()) as LinkedInUserinfo;
}

export async function inferInterests(
  userinfo: LinkedInUserinfo,
): Promise<InferredInterests> {
  try {
    const r = await fetch(`${API_BASE_URL}${API_PREFIX}/onboard/infer-interests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ linkedin_userinfo: userinfo }),
    });
    if (r.ok) return (await r.json()) as InferredInterests;
    // 404/501: endpoint not yet deployed → fall through to mock
    if (r.status !== 404 && r.status !== 501 && r.status !== 503) {
      throw new Error(`Inference failed: ${r.status}`);
    }
  } catch (e) {
    console.warn("Live inference unavailable, using mock:", e);
  }
  return mockInference(userinfo);
}

/**
 * Deterministic mock so the UX is testable end-to-end before the live agent
 * is wired. Hashes the userinfo to pick a plausible profile.
 */
function mockInference(u: LinkedInUserinfo): InferredInterests {
  const hash = Array.from(u.sub + u.name).reduce(
    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0,
    7,
  );
  const cities = [
    "Salt Lake City",
    "Provo",
    "Lehi",
    "Park City",
    "Ogden",
    "St. George",
  ];
  const sectorPools = [
    ["B2B Software"],
    ["FinTech"],
    ["Life Sciences"],
    ["AI / ML"],
    ["Security"],
    ["B2B Software", "AI / ML"],
  ];
  const stagePools = [["seed"], ["series_a"], ["pre_seed"], ["seed", "series_a"]];
  const lookingForPools: InferredInterests["lookingFor"][] = [
    ["both"],
    ["resources"],
    ["startups"],
    ["both"],
  ];
  const idx = (n: number, pool: number) => Math.abs(hash + n) % pool;
  const city = cities[idx(0, cities.length)];
  const sectors = sectorPools[idx(1, sectorPools.length)];
  const stages = stagePools[idx(2, stagePools.length)];
  const lookingFor = lookingForPools[idx(3, lookingForPools.length)];
  const firstName = u.given_name || u.name.split(" ")[0] || "you";
  return {
    city,
    sectors,
    stages,
    lookingFor,
    evidence: [
      `LinkedIn lists ${firstName} based in ${city}, UT.`,
      `Public bio mentions ${sectors[0].toLowerCase()} interest.`,
      `Backend agent isn't online yet — these are placeholder guesses you can edit.`,
    ],
    confidence: "low",
  };
}

/**
 * Resolves the LinkedIn login URL (kicks off the OAuth dance).
 * The existing backend route handles state-cookie + redirect.
 */
export function linkedInLoginUrl(): string {
  return `${API_BASE_URL}${API_PREFIX}/auth/linkedin/login`;
}

/**
 * Distill a user's free-form prose into 3-8 concise matchable keywords.
 * Backed by `POST /onboard/extract-keywords` which runs a short Claude call.
 * Returns [] on failure so the UI can degrade gracefully.
 */
export async function extractKeywords(text: string): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const r = await fetch(`${API_BASE_URL}${API_PREFIX}/onboard/extract-keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { keywords?: string[] };
    return Array.isArray(data.keywords) ? data.keywords : [];
  } catch {
    return [];
  }
}
