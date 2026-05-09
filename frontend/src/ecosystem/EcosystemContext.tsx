import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface UserMatch {
  // From LinkedIn OIDC (always present once signed in)
  name: string;
  email: string;
  picture: string;
  // Inferred / confirmed by the user
  city: string;
  sectors: string[]; // e.g. ["B2B Software"]
  stages: string[]; // e.g. ["seed"]
  lookingFor: ("resources" | "startups" | "both")[];
  /**
   * Max distance in miles from the user's city. null = no limit (statewide).
   * Used to filter both the resource list and the startup map markers.
   */
  distanceMaxMiles: number | null;
  /**
   * LLM-extracted keywords from the user's free-form "anything else?" text.
   * Promoted into UserMatch only when the user explicitly toggles them on
   * in the suggestion chips. Used by the resource scorer to substring-match
   * against title + description for richer signal beyond sector/stage.
   */
  keywords: string[];
  // Provenance — what Claude / web search surfaced
  evidence: string[]; // human-readable snippets
}

interface EcosystemContextValue {
  match: UserMatch | null;
  setMatch: (m: UserMatch | null) => void;
  clearMatch: () => void;
}

const Ctx = createContext<EcosystemContextValue | null>(null);

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const [match, setMatchState] = useState<UserMatch | null>(null);

  const setMatch = useCallback((m: UserMatch | null) => setMatchState(m), []);
  const clearMatch = useCallback(() => setMatchState(null), []);

  const value = useMemo(
    () => ({ match, setMatch, clearMatch }),
    [match, setMatch, clearMatch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEcosystem(): EcosystemContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEcosystem must be used inside EcosystemProvider");
  return v;
}
