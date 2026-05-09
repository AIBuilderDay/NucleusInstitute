import type { EcosystemStartup } from "../types";
import { StartupMap } from "../components/StartupMap";

interface MapViewProps {
  startups: EcosystemStartup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapView({ startups, selectedId, onSelect }: MapViewProps) {
  return (
    <div style={{ height: "calc(100vh - 280px)", minHeight: 520 }}>
      <StartupMap startups={startups} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}
