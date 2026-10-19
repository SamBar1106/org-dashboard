import { levelTone } from "../model/inspector";
import type { DatabaseRack } from "../model/types";

export function Legend({ racks }: { racks: DatabaseRack[] }) {
  return (
    <p className="legend">
      <span className="legend-label">DATA VAULT</span>
      {racks.map((rack) => (
        <span key={rack.id} className="legend-item">
          <i className={`dot tone-${levelTone(rack.level)}`} />
          {rack.name}
        </span>
      ))}
    </p>
  );
}
