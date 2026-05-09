// Loader for the GOED Resources List CSV. The other Claude chat will eventually
// build a richer Founder's Navigator that uses an embedding-based search; this
// is a hackathon-scoped lightweight loader that's good enough to surface a
// ranked top-N to a matched user.

import Papa from "papaparse";

const CSV_PATH = "/data/Resources List Builder Day.csv";

export interface Resource {
  id: string;
  title: string;
  description: string;
  industries: string[];
  locations: string[]; // Utah counties
  topics: string[];
  communities: string[];
  link: string;
  email: string;
}

interface RawRow {
  id?: string;
  Title?: string;
  description?: string;
  Communities?: string;
  Industries?: string;
  Locations?: string;
  Topics?: string;
  link?: string;
  email?: string;
}

function pipeSplit(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

let cache: Resource[] | null = null;

export async function loadResources(): Promise<Resource[]> {
  if (cache) return cache;
  const res = await fetch(CSV_PATH);
  if (!res.ok) throw new Error(`Could not load ${CSV_PATH}: ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.warn("Resources CSV parse warnings:", parsed.errors.slice(0, 3));
  }
  cache = parsed.data
    .map((row): Resource | null => {
      const title = (row.Title ?? "").trim();
      if (!title) return null;
      return {
        id: (row.id ?? title).trim(),
        title,
        description: (row.description ?? "").trim(),
        industries: pipeSplit(row.Industries),
        locations: pipeSplit(row.Locations),
        topics: pipeSplit(row.Topics),
        communities: pipeSplit(row.Communities),
        link: (row.link ?? "").trim(),
        email: (row.email ?? "").trim(),
      };
    })
    .filter((x): x is Resource => x !== null);
  return cache;
}
