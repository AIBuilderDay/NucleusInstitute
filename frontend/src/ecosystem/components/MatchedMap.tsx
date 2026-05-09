import { useEffect, useMemo, useState } from "react";
import type { UserMatch } from "../EcosystemContext";
import {
  loadEcosystemStartups,
} from "../utah-startup-map/data/loader";
import type {
  EcosystemStartup,
  Stage,
} from "../utah-startup-map/types";
import { coordsFor } from "../utah-startup-map/data/cityCoords";
import { distanceMiles } from "../data/resourceScoring";
import { StartupMap } from "../utah-startup-map/components/StartupMap";
import { StartupDetailPanel } from "../utah-startup-map/components/StartupDetailPanel";

interface MatchedMapProps {
  match: UserMatch;
}

const VALID_STAGES: ReadonlyArray<Stage> = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c_plus",
  "growth",
  "public",
  "unknown",
];

export function MatchedMap({ match }: MatchedMapProps) {
  const [startups, setStartups] = useState<EcosystemStartup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const r = await loadEcosystemStartups();
        if (!dead) setStartups(r);
      } catch {
        // map gracefully shows empty state
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!startups.length) return [];
    const sectorSet = new Set(match.sectors);
    const stageSet = new Set(
      match.stages.filter((s): s is Stage =>
        (VALID_STAGES as readonly string[]).includes(s),
      ),
    );
    const userCoords = match.city ? coordsFor(match.city, "user-anchor") : null;
    return startups.filter((s) => {
      if (sectorSet.size && !sectorSet.has(s.section)) return false;
      if (stageSet.size && !stageSet.has(s.stage)) return false;
      // Distance filter (replaces strict same-city match): keep startups
      // within X miles of the user's city centroid.
      if (match.distanceMaxMiles != null && userCoords) {
        const startupCoords: [number, number] = [s.lng, s.lat];
        if (distanceMiles(userCoords, startupCoords) > match.distanceMaxMiles) {
          return false;
        }
      }
      return true;
    });
  }, [startups, match]);

  const focusCoords = useMemo<[number, number] | null>(() => {
    if (!match.city) return null;
    return coordsFor(match.city, "matched-anchor");
  }, [match.city]);

  const selected = useMemo(
    () => (selectedId ? startups.find((s) => s.id === selectedId) ?? null : null),
    [selectedId, startups],
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <div className="tiny-caps" style={{ color: "var(--nucleus-blue)" }}>
            Map · {match.city || "Utah"}
          </div>
          <h3
            className="display"
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "var(--nucleus-blue)",
              margin: "2px 0 0",
              lineHeight: 1.2,
            }}
          >
            {visible.length} matching startups
          </h3>
        </div>
      </div>

      <div style={{ height: 460 }}>
        {loading ? (
          <div className="shimmer" style={{ height: "100%" }} />
        ) : (
          <StartupMap
            startups={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            focusCoords={focusCoords}
            focusZoom={11}
          />
        )}
      </div>

      <StartupDetailPanel startup={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
