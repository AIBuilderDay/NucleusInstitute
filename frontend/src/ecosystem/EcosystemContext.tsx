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
