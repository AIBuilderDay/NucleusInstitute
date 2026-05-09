// Frontend types that mirror backend Pydantic schemas in
// backend/app/model/schema/. See glossary.html for the narrative.

export type Sector =
  | "life_sciences"
  | "ai"
  | "defense_aerospace"
  | "cyber"
  | "energy"
  | "advanced_manufacturing"
  | "fintech"
  | "software";

export type Network =
  | "operator"
  | "mentor"
  | "sme_advisor"
  | "venture"
  | "service_provider";

export type Stage = "idea" | "pre_seed" | "seed" | "series_a" | "growth";

export type RoleCategory =
  | "executive"
  | "operator"
  | "mentor"
  | "advisor"
  | "investor"
  | "service_provider"
  | "student"
  | "intern"
  | "board_member";

export type Availability =
  | "full_time"
  | "part_time"
  | "fractional"
  | "advisory"
  | "internship";

export type RoleTitle =
  | "ceo"
  | "cto"
  | "coo"
  | "cfo"
  | "cofounder"
  | "fractional_exec"
  | "engineer"
  | "sales"
  | "biz_dev"
  | "regulatory"
  | "other";

export type CompExpectation = "salary" | "equity" | "salary_plus_equity" | "free";
export type RiskTolerance = "low" | "medium" | "high";

export interface InvestorProfile {
  investor_type: "angel" | "syndicate" | "fund" | "family_office" | "vc" | "corporate_vc";
  typical_check_size: string;
  portfolio_size?: number;
  utah_only?: boolean;
  lead_check?: boolean;
  stages_invested?: Stage[];
  sectors_focused?: Sector[];
}

export interface ServiceProviderProfile {
  service_type: string;
  firm_name: string;
  startup_friendly_terms?: boolean;
  stages_served?: Stage[];
  sectors_served?: Sector[];
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  headline: string;
  role_category: RoleCategory;
  availability: Availability;
  years_experience: number;
  sectors_of_interest: Sector[];
  stage_preference: Stage[];
  role_titles_seeking: RoleTitle[];
  skills: string[];
  comp_expectation_type: CompExpectation;
  comp_min_salary_usd?: number;
  comp_min_equity_pct?: number;
  location_city: string;
  remote_ok: boolean;
  primary_network: Network;
  university_affiliations?: string[];
  mission_keywords?: string[];
  risk_tolerance?: RiskTolerance;
  bio?: string;
  trust_badges?: string[];
  investor_profile?: InvestorProfile;
  service_provider_profile?: ServiceProviderProfile;
}

export interface Startup {
  id: string;
  name: string;
  one_liner: string;
  sector: Sector;
  sectors_secondary?: Sector[];
  stage: Stage;
  funding_status: string;
  total_raised_usd: number;
  team_size: number;
  location_city: string;
  remote_ok: boolean;
  origin?: string;
  roles_needed: RoleTitle[];
  role_categories_open_to: RoleCategory[];
  availability_open_to: Availability[];
  seeking_investment: boolean;
  target_raise_usd?: number;
  comp_offered_type: CompExpectation;
  comp_max_salary_usd?: number;
  required_skills: string[];
  mission_keywords?: string[];
  university_lab_origin?: string;
  trust_badges?: string[];
  description?: string;
}

// Mirrors the keys backend/app/provider/matching/rule_filter.py emits.
// Backend only includes dimensions that have non-zero weight for the
// talent's role_category, so this is intentionally Partial.
export type DimensionKey =
  | "role"
  | "sector"
  | "stage"
  | "skills"
  | "mission"
  | "location"
  | "risk";

export type DimensionScores = Partial<Record<DimensionKey, number>>;

export interface MatchResult {
  talent_id: string;
  startup_id: string;
  score: number;
  passed_hard_filters: boolean;
  dimension_scores: DimensionScores;
  reasons: string[];
  blockers: string[];
  matcher: string;
  // Hydrated client-side from the loaded people/startups list.
  startup?: Startup;
  person?: Person;
}

export interface MatchResponse {
  source: "live" | "mock";
  matches: MatchResult[];
  talent?: Person;
  startup?: Startup;
}

export type MatcherKey = string;

export interface CompareResponse {
  source: "live" | "mock";
  by_matcher: Record<MatcherKey, MatchResult[]>;
}

export interface ConnectionEdge {
  person: Person;
  warmth: number;
}

export interface PingResult {
  live: boolean;
  info?: unknown;
  url?: string;
}
