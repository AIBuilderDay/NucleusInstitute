// Local types for the Ecosystem sub-app. Decoupled from the Nucleus Startup
// schema on purpose — this experience is fed by the GOED Map Data CSV, not
// the backend.

export type EmployeeBucket =
  | "1"
  | "2-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1000+"
  | "unknown";

export type Stage =
  | "pre_seed"
  | "seed"
  | "series_a"
  | "series_b"
  | "series_c_plus"
  | "growth"
  | "public"
  | "unknown";

export interface EcosystemStartup {
  id: string;             // slugified name — stable across reloads
  name: string;
  address: string;
  city: string;           // extracted from address
  description: string;
  website: string;        // normalized to https://
  linkedin: string;       // normalized
  stage: Stage;
  stageRaw: string;       // original CSV value for display fallback
  employees: EmployeeBucket;
  employeesRaw: string;
  section: string;        // sector — "B2B Software", "FinTech", etc. — free taxonomy from CSV
  // computed positioning
  lng: number;
  lat: number;
  // derived flags
  hasDescription: boolean;
}

export type EcosystemView = "map" | "list";
