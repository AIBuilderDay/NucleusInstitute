// Single source of truth for the backend base URL.
// In dev, the FastAPI server defaults to http://localhost:8765 (see Taskfile.yml).
// For deploy, set VITE_API_BASE_URL at build time, e.g.:
//   VITE_API_BASE_URL=https://api.example.com pnpm build
//
// At runtime, a value in localStorage["nucleus.api"] takes precedence so a
// developer can repoint the frontend without rebuilding.

const ENV_BASE = import.meta.env.VITE_API_BASE_URL?.trim();
const FALLBACK_BASE = "http://localhost:8765";

function resolveBase(): string {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("nucleus.api");
    if (stored && stored.trim()) return stored.trim();
  }
  if (ENV_BASE) return ENV_BASE;
  return FALLBACK_BASE;
}

export const API_BASE_URL = resolveBase();

export function setApiBase(url: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("nucleus.api", url);
  }
  // Caller should reload to re-run module init; intentionally no live mutation.
}

export const API_PREFIX = "/api/v1";
