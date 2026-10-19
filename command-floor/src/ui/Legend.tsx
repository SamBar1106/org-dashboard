import { levelTone } from "../model/inspector";
import { useDisplayedFloor, useFloor } from "../state/store";

export function Legend() {
  const floor = useDisplayedFloor();
  const hiddenRacks = useFloor((state) => state.hiddenRacks);
  const toggleRack = useFloor((state) => state.toggleRack);
  return (
    <div className="legend">
      <span className="legend-label">DATA VAULT</span>
      {floor.database_racks.map((rack) => {
        const shown = !hiddenRacks.includes(rack.id);
        return (
          <button
            key={rack.id}
            type="button"
            className="legend-item"
            data-testid={`legend-${rack.id}`}
            aria-pressed={shown}
            onClick={() => toggleRack(rack.id)}
          >
            <i className={`dot tone-${levelTone(rack.level)}`} />
            {rack.name}
          </button>
        );
      })}
    </div>
  );
}
