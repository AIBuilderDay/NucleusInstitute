// Human-readable labels for every enum in the matcher taxonomy.
// Mirrors backend/app/model/schema/enums.py (see glossary.html for narrative).

import type {
  Availability,
  CompExpectation,
  Network,
  RoleCategory,
  RoleTitle,
  Sector,
  Stage,
} from "./types";

export const SECTORS: Sector[] = [
  "life_sciences",
  "ai",
  "defense_aerospace",
  "cyber",
  "energy",
  "advanced_manufacturing",
  "fintech",
  "software",
];

export const SECTOR_LABEL: Record<Sector, string> = {
  life_sciences: "Life Sciences",
  ai: "AI",
  defense_aerospace: "Defense & Aerospace",
  cyber: "Cyber",
  energy: "Energy",
  advanced_manufacturing: "Advanced Mfg.",
  fintech: "Fintech",
  software: "Software",
};

export const NETWORKS: Network[] = [
  "operator",
  "mentor",
  "sme_advisor",
  "venture",
  "service_provider",
];

export const NETWORK_LABEL: Record<Network, string> = {
  operator: "Operator Network",
  mentor: "Mentor Network",
  sme_advisor: "SME Advisory",
  venture: "Venture Network",
  service_provider: "Service Provider",
};

// One-line description shown on filter hover / detail panes. Mirrors
// glossary.html § "The 5 Nucleus Networks".
export const NETWORK_DESCRIPTION: Record<Network, string> = {
  operator: "Execs and senior operators looking for full-time or fractional roles at a startup.",
  mentor: "Informal, time-flexible volunteers — coffee chats, no pay or equity expected.",
  sme_advisor: "Formal subject-matter experts on advisory boards. Often paid in equity.",
  venture: "Angel investors and VCs focused on Utah deep tech.",
  service_provider: "Legal / creative / operational / technical service firms supporting startups.",
};

export const STAGES: Stage[] = ["idea", "pre_seed", "seed", "series_a", "growth"];

export const STAGE_LABEL: Record<Stage, string> = {
  idea: "Idea",
  pre_seed: "Pre-Seed",
  seed: "Seed",
  series_a: "Series A",
  growth: "Growth",
};

export const ROLE_CATEGORIES: RoleCategory[] = [
  "executive",
  "operator",
  "advisor",
  "mentor",
  "investor",
  "service_provider",
  "board_member",
  "student",
  "intern",
];

export const ROLE_CATEGORY_LABEL: Record<RoleCategory, string> = {
  executive: "Executive",
  operator: "Operator",
  advisor: "Advisor",
  mentor: "Mentor",
  investor: "Investor",
  service_provider: "Service Provider",
  board_member: "Board Member",
  student: "Student",
  intern: "Intern",
};

export const AVAILABILITIES: Availability[] = [
  "full_time",
  "part_time",
  "fractional",
  "advisory",
  "internship",
];

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  fractional: "Fractional",
  advisory: "Advisory",
  internship: "Internship",
};

export const COMP_EXPECTATIONS: CompExpectation[] = [
  "salary",
  "equity",
  "salary_plus_equity",
  "free",
];

export const COMP_EXPECTATION_LABEL: Record<CompExpectation, string> = {
  salary: "Salary",
  equity: "Equity",
  salary_plus_equity: "Salary + equity",
  free: "Volunteer / free",
};

export const ROLE_TITLE_LABEL: Record<RoleTitle, string> = {
  ceo: "CEO",
  cto: "CTO",
  coo: "COO",
  cfo: "CFO",
  cofounder: "Co-founder",
  fractional_exec: "Fractional Exec",
  engineer: "Engineer",
  sales: "Sales",
  biz_dev: "Biz Dev",
  regulatory: "Regulatory",
  other: "Other",
};
