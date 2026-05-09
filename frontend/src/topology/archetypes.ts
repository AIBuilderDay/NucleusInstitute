import type { Person, RoleCategory } from "../types";
import type { TopologyScores } from "./types";
import { DIMENSION_ORDER } from "./types";
import { normalizePersonTopology } from "./normalizer";

const FLAT: TopologyScores = {
  role: 0.5,
  sector: 0.5,
  stage: 0.5,
  skills: 0.5,
  mission: 0.5,
  location: 0.5,
  risk: 0.5,
};

export function computeArchetypes(
  people: Person[],
): Record<RoleCategory, TopologyScores> {
  const groups = new Map<RoleCategory, TopologyScores[]>();

  for (const p of people) {
    const cat = p.role_category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(normalizePersonTopology(p));
  }

  const result = {} as Record<RoleCategory, TopologyScores>;
  const allCategories: RoleCategory[] = [
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

  for (const cat of allCategories) {
    const members = groups.get(cat);
    if (!members || members.length === 0) {
      result[cat] = { ...FLAT };
      continue;
    }
    const avg = { ...FLAT };
    for (const dim of DIMENSION_ORDER) {
      avg[dim] =
        members.reduce((sum, m) => sum + m[dim], 0) / members.length;
    }
    result[cat] = avg;
  }

  return result;
}
