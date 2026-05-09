// CSV loader for the GOED Map Data starter pack.
// File lives at /public/data/Map Data for Builder Day.csv and is fetched at
// runtime via the static path. papaparse handles multi-line quoted fields
// (descriptions span newlines) which a hand-rolled split would mangle.

import Papa from "papaparse";
import type { EcosystemStartup, EmployeeBucket, Stage } from "../types";
import { coordsFor, extractCity } from "./cityCoords";

const CSV_PATH = "/data/Map Data for Builder Day.csv";

interface RawRow {
  "Display Type"?: string;
  "LinkedIn Link (map it to Links to get the logo)"?: string;
  "Startup Name "?: string;
  "Startup Name"?: string;
  "Full Address"?: string;
  "Description of startup"?: string;
  Website?: string;
  Stage?: string;
  "# of Employees "?: string;
  "# of Employees"?: string;
  Section?: string;
}

function pick(row: RawRow, ...keys: Array<keyof RawRow>): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const STAGE_MAP: Record<string, Stage> = {
  "pre-seed": "pre_seed",
  "preseed": "pre_seed",
  "pre seed": "pre_seed",
  seed: "seed",
  "series a": "series_a",
  "series b": "series_b",
  "series c": "series_c_plus",
  "series c+": "series_c_plus",
  "series d": "series_c_plus",
  "series d+": "series_c_plus",
  growth: "growth",
  "late stage": "growth",
  public: "public",
  ipo: "public",
};

function normalizeStage(raw: string): Stage {
  const key = raw.toLowerCase().trim();
  return STAGE_MAP[key] ?? "unknown";
}

const EMPLOYEE_BUCKETS: ReadonlyArray<{ test: RegExp; bucket: EmployeeBucket }> = [
  { test: /^1$|^solo$|^founder$/i, bucket: "1" },
  { test: /2-?10/, bucket: "2-10" },
  { test: /11-?50/, bucket: "11-50" },
  { test: /51-?200/, bucket: "51-200" },
  { test: /201-?500/, bucket: "201-500" },
  { test: /501-?1000/, bucket: "501-1000" },
  { test: /1000\+|10001\+|over 1000/i, bucket: "1000+" },
];

function normalizeEmployees(raw: string): EmployeeBucket {
  const t = raw.trim();
  if (!t) return "unknown";
  for (const { test, bucket } of EMPLOYEE_BUCKETS) {
    if (test.test(t)) return bucket;
  }
  return "unknown";
}

export async function loadEcosystemStartups(): Promise<EcosystemStartup[]> {
  const res = await fetch(CSV_PATH);
  if (!res.ok) throw new Error(`Could not load ${CSV_PATH}: ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    // Errors are usually benign (extra commas in descriptions); log and continue.
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 3));
  }

  const rows = parsed.data
    .map((row): EcosystemStartup | null => {
      const name = pick(row, "Startup Name ", "Startup Name");
      if (!name) return null;
      const address = pick(row, "Full Address");
      const city = extractCity(address);
      const description = pick(row, "Description of startup");
      const stageRaw = pick(row, "Stage");
      const employeesRaw = pick(row, "# of Employees ", "# of Employees");
      const id = slugify(name);
      const [lng, lat] = coordsFor(city, id);

      return {
        id,
        name,
        address,
        city,
        description,
        website: normalizeUrl(pick(row, "Website")),
        linkedin: normalizeUrl(
          pick(row, "LinkedIn Link (map it to Links to get the logo)"),
        ),
        stage: normalizeStage(stageRaw),
        stageRaw,
        employees: normalizeEmployees(employeesRaw),
        employeesRaw,
        section: pick(row, "Section"),
        lng,
        lat,
        hasDescription: description.length > 0,
      };
    })
    .filter((x): x is EcosystemStartup => x !== null);

  return rows;
}
