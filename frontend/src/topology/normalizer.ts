import type { Person } from "../types";
import type { TopologyScores } from "./types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const RISK_MAP: Record<string, number> = { low: 0.3, medium: 0.6, high: 1.0 };

export function normalizePersonTopology(person: Person): TopologyScores {
  const role =
    clamp(person.role_titles_seeking.length / 3, 0, 1) * 0.7 +
    clamp(person.years_experience / 15, 0, 1) * 0.3;

  const sector = clamp(person.sectors_of_interest.length / 3, 0, 1);

  const stage = clamp(person.stage_preference.length / 3, 0, 1);

  const skills = clamp(person.skills.length / 8, 0, 1);

  const missions = person.mission_keywords ?? [];
  const mission = clamp(missions.length / 4, 0, 1);

  const location = 0.3 + (person.remote_ok ? 0.4 : 0);

  const risk = RISK_MAP[person.risk_tolerance ?? "medium"] ?? 0.6;

  return { role, sector, stage, skills, mission, location, risk };
}
