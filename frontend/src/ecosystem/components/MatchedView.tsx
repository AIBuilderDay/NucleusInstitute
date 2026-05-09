import type { UserMatch } from "../EcosystemContext";
import { MatchedMap } from "./MatchedMap";
import { ProfileDescriber } from "./ProfileDescriber";
import { ResourceMatchList } from "./ResourceMatchList";

interface MatchedViewProps {
  match: UserMatch;
  onEdit: () => void;
  onReset: () => void;
}

/**
 * Post-confirm layout: profile describer on top (full width), then a
 * map / resource-list split below (map on the LEFT, resources on the RIGHT).
 */
export function MatchedView({ match, onEdit, onReset }: MatchedViewProps) {
  return (
    <div>
      <ProfileDescriber match={match} onEdit={onEdit} onReset={onReset} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <MatchedMap match={match} />
        <ResourceMatchList match={match} />
      </div>
    </div>
  );
}
