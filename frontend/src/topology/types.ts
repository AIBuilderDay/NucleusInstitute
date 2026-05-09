import type { Person, RoleCategory } from "../types";

export interface TopologyScores {
  role: number;
  sector: number;
  stage: number;
  skills: number;
  mission: number;
  location: number;
  risk: number;
}

export const DIMENSION_ORDER: (keyof TopologyScores)[] = [
  "role",
  "sector",
  "stage",
  "skills",
  "mission",
  "location",
  "risk",
];

export const DIMENSION_LABELS: Record<keyof TopologyScores, string> = {
  role: "Role",
  sector: "Sector",
  stage: "Stage",
  skills: "Skills",
  mission: "Mission",
  location: "Location",
  risk: "Risk",
};

export type CompareTarget =
  | { kind: "person"; person: Person }
  | { kind: "archetype"; category: RoleCategory };
