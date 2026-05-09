// Lightweight scoring for matching Resources to a UserMatch. Replace with
// the agent-driven embedding scorer when the Founder's Navigator backend
// lands; this is good enough for the demo.

import type { UserMatch } from "../EcosystemContext";
import type { Resource } from "./resourcesLoader";

// — Sector ↔ CSV "Industries" — the CSV uses the GOED taxonomy, ours is
//   from the Map Data CSV. Both are messy free-form, so we map directly.
const SECTOR_TO_INDUSTRIES: Record<string, string[]> = {
  "B2B Software": ["Software and Information Technology"],
  "B2C Software": ["Software and Information Technology"],
  Software: ["Software and Information Technology"],
  "AI / ML": ["Software and Information Technology"],
  AI: ["Software and Information Technology"],
  FinTech: ["Financial Services"],
  "Life Sciences": ["Life Sciences and Healthcare"],
  Biotech: ["Life Sciences and Healthcare"],
  HealthTech: ["Life Sciences and Healthcare"],
  Health: ["Life Sciences and Healthcare"],
  "Medical Devices": ["Life Sciences and Healthcare"],
  Hardware: ["Manufacturing"],
  Manufacturing: ["Manufacturing"],
  "Advanced Manufacturing": ["Manufacturing"],
  Energy: ["Other"], // GOED CSV doesn't have an energy industry; falls through
  Cleantech: ["Other"],
  "Defense & Aerospace": ["Aerospace and Defense"],
  Defense: ["Aerospace and Defense"],
  Aerospace: ["Aerospace and Defense"],
  Security: ["Software and Information Technology"],
  Cybersecurity: ["Software and Information Technology"],
  Consumer: ["Consumer Packaged Goods", "Hospitality and Food Services"],
  CPG: ["Consumer Packaged Goods"],
  "Consumer Goods": ["Consumer Packaged Goods"],
  EdTech: ["Software and Information Technology"],
  Education: ["Other"],
  AgTech: ["Agriculture"],
  Agriculture: ["Agriculture"],
  "Real Estate": ["Other"],
  PropTech: ["Other"],
};

// — City ↔ Utah county — the CSV uses county names ("Salt Lake", "Utah").
const CITY_TO_COUNTY: Record<string, string> = {
  "salt lake city": "Salt Lake",
  "south salt lake": "Salt Lake",
  "west valley city": "Salt Lake",
  "west jordan": "Salt Lake",
  "south jordan": "Salt Lake",
  sandy: "Salt Lake",
  draper: "Salt Lake",
  midvale: "Salt Lake",
  murray: "Salt Lake",
  millcreek: "Salt Lake",
  holladay: "Salt Lake",
  taylorsville: "Salt Lake",
  kearns: "Salt Lake",
  "cottonwood heights": "Salt Lake",
  provo: "Utah",
  orem: "Utah",
  lehi: "Utah",
  "american fork": "Utah",
  "pleasant grove": "Utah",
  "spanish fork": "Utah",
  "saratoga springs": "Utah",
  "eagle mountain": "Utah",
  "park city": "Summit",
  "heber city": "Wasatch",
  midway: "Wasatch",
  ogden: "Weber",
  "south ogden": "Weber",
  "north ogden": "Weber",
  roy: "Weber",
  layton: "Davis",
  kaysville: "Davis",
  farmington: "Davis",
  centerville: "Davis",
  bountiful: "Davis",
  syracuse: "Davis",
  clearfield: "Davis",
  logan: "Cache",
  smithfield: "Cache",
  "north logan": "Cache",
  "st. george": "Washington",
  "saint george": "Washington",
  "st george": "Washington",
  washington: "Washington",
  hurricane: "Washington",
  ivins: "Washington",
  "santa clara": "Washington",
  "cedar city": "Iron",
  moab: "Grand",
  vernal: "Uintah",
  tooele: "Tooele",
  tremonton: "Box Elder",
  "brigham city": "Box Elder",
  richfield: "Sevier",
  price: "Carbon",
  blanding: "San Juan",
  monticello: "San Juan",
};

export function cityToCounty(city: string): string | null {
  const k = city.toLowerCase().trim();
  return CITY_TO_COUNTY[k] ?? null;
}

interface ScoreParts {
  industry: number;
  geography: number;
  topic: number;
  total: number;
  reasons: string[];
}

export function scoreResource(r: Resource, m: UserMatch): ScoreParts {
  const reasons: string[] = [];
  let industry = 0;
  let geography = 0;
  let topic = 0;

  // — industry overlap —
  const userIndustries = new Set<string>();
  for (const sector of m.sectors) {
    for (const ind of SECTOR_TO_INDUSTRIES[sector] ?? []) {
      userIndustries.add(ind);
    }
  }
  if (userIndustries.size && r.industries.length) {
    const hit = r.industries.find((ri) => userIndustries.has(ri));
    if (hit) {
      industry = 3;
      reasons.push(`Industry: ${hit}`);
    } else if (r.industries.includes("Other")) {
      industry = 0.5; // weak generic match
    }
  } else if (r.industries.length === 0 || r.industries.includes("Other")) {
    industry = 0.5; // resource is industry-agnostic — neither hurts nor helps
  }

  // — geography (county) —
  const county = cityToCounty(m.city);
  if (county && r.locations.includes(county)) {
    geography = 2;
    reasons.push(`Available in ${county} County`);
  } else if (r.locations.length === 0) {
    geography = 0.5; // statewide / unspecified
  }

  // — topic (lifecycle / stage) keywords —
  // The CSV uses values like "Late Stage Growth"; the user's stages are enum
  // strings. We do a soft string-contains match on stage name.
  if (r.topics.length && m.stages.length) {
    const stageHints = m.stages
      .map((s) => s.replace(/_/g, " ").toLowerCase())
      .filter(Boolean);
    const topicLow = r.topics.map((t) => t.toLowerCase());
    const matched = r.topics.find((t, i) =>
      stageHints.some((h) => topicLow[i].includes(h.split(" ")[0])),
    );
    if (matched) {
      topic = 1;
      reasons.push(`Topic: ${matched}`);
    }
  }

  const total = industry + geography + topic;
  return { industry, geography, topic, total, reasons };
}

export interface RankedResource {
  resource: Resource;
  score: number;
  reasons: string[];
}

export function rankResources(all: Resource[], m: UserMatch): RankedResource[] {
  return all
    .map((r) => {
      const s = scoreResource(r, m);
      return { resource: r, score: s.total, reasons: s.reasons };
    })
    .sort((a, b) =>
      b.score === a.score
        ? a.resource.title.localeCompare(b.resource.title)
        : b.score - a.score,
    );
}
