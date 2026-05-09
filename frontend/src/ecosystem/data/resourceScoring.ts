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

// — Utah county centroids ([lng, lat]) — for distance filtering. Approximate
// geographic centers; close enough for hackathon-grade "is this within X
// miles" decisions.
const COUNTY_COORDS: Record<string, [number, number]> = {
  "Beaver": [-113.20, 38.36],
  "Box Elder": [-113.08, 41.50],
  "Cache": [-111.74, 41.74],
  "Carbon": [-110.59, 39.65],
  "Daggett": [-109.51, 40.89],
  "Davis": [-112.10, 41.00],
  "Duchesne": [-110.42, 40.30],
  "Emery": [-110.70, 38.99],
  "Garfield": [-111.43, 37.85],
  "Grand": [-109.57, 38.98],
  "Iron": [-113.29, 37.86],
  "Juab": [-112.78, 39.70],
  "Kane": [-111.89, 37.28],
  "Millard": [-113.13, 39.07],
  "Morgan": [-111.57, 41.08],
  "Piute": [-112.13, 38.34],
  "Rich": [-111.24, 41.62],
  "Salt Lake": [-111.92, 40.66],
  "San Juan": [-109.81, 37.62],
  "Sanpete": [-111.59, 39.37],
  "Sevier": [-111.79, 38.74],
  "Summit": [-110.96, 40.87],
  "Tooele": [-113.13, 40.51],
  "Uintah": [-109.52, 40.13],
  "Utah": [-111.67, 40.12],
  "Wasatch": [-111.17, 40.33],
  "Washington": [-113.51, 37.28],
  "Wayne": [-110.95, 38.32],
  "Weber": [-112.05, 41.27],
};

export function countyCoords(county: string): [number, number] | null {
  return COUNTY_COORDS[county] ?? null;
}

/**
 * Haversine distance in miles between two [lng, lat] pairs.
 * Cheap, no deps. Accurate to a few percent at this scale.
 */
export function distanceMiles(
  a: [number, number],
  b: [number, number],
): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 3958.8; // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Min distance from a city centroid to any of the resource's listed counties.
 * Returns Infinity if we can't resolve coords on either side.
 */
export function resourceDistanceMiles(
  r: Resource,
  userCityCoords: [number, number] | null,
): number {
  if (!userCityCoords || r.locations.length === 0) return Infinity;
  let best = Infinity;
  for (const loc of r.locations) {
    const c = countyCoords(loc);
    if (c) {
      const d = distanceMiles(userCityCoords, c);
      if (d < best) best = d;
    }
  }
  return best;
}

interface ScoreParts {
  industry: number;
  geography: number;
  topic: number;
  keyword: number;
  total: number;
  reasons: string[];
}

/**
 * Scoring rewards SPECIFICITY:
 *   industry = (matched / total industries listed) * 3
 *
 * Without this, a resource that lists every industry under the sun gets the
 * same score for every user as a resource laser-focused on one industry.
 * Editing the user's sector wouldn't change rankings — the bug we just fixed.
 */
export function scoreResource(r: Resource, m: UserMatch): ScoreParts {
  const reasons: string[] = [];
  let industry = 0;
  let geography = 0;
  let topic = 0;

  // — industry overlap (specificity-aware) —
  const userIndustries = new Set<string>();
  for (const sector of m.sectors) {
    for (const ind of SECTOR_TO_INDUSTRIES[sector] ?? []) {
      userIndustries.add(ind);
    }
  }
  if (userIndustries.size && r.industries.length) {
    const matches = r.industries.filter((ri) => userIndustries.has(ri));
    if (matches.length) {
      const specificity = matches.length / r.industries.length;
      industry = specificity * 3;
      reasons.push(`Industry: ${matches[0]}`);
    }
  } else if (r.industries.length === 0) {
    industry = 0.4; // resource is industry-agnostic
  }

  // — geography (county) —
  const county = cityToCounty(m.city);
  if (county && r.locations.includes(county)) {
    // Reward narrowly-scoped geo: county-only listing > statewide listing
    const geoSpecificity = 1 / Math.max(1, r.locations.length);
    geography = 1 + geoSpecificity * 2; // 1.0 (statewide) up to 3.0 (single county)
    reasons.push(`Available in ${county} County`);
  } else if (r.locations.length === 0) {
    geography = 0.4; // unscoped — neutral
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

  // — keyword match (LLM-extracted from user's free-form text) —
  // Substring match (case-insensitive) against the resource's searchable
  // text. Each hit scores +1; capped at +3 so keywords don't drown out
  // structured signals.
  let keyword = 0;
  if (m.keywords.length) {
    const haystack = (
      r.title +
      " " +
      r.description +
      " " +
      r.industries.join(" ") +
      " " +
      r.topics.join(" ")
    ).toLowerCase();
    const hits: string[] = [];
    for (const kw of m.keywords) {
      const k = kw.toLowerCase().trim();
      if (k && haystack.includes(k)) hits.push(kw);
    }
    if (hits.length) {
      keyword = Math.min(3, hits.length);
      reasons.push(`Mentions: ${hits.slice(0, 3).join(", ")}`);
    }
  }

  const total = industry + geography + topic + keyword;
  return { industry, geography, topic, keyword, total, reasons };
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
