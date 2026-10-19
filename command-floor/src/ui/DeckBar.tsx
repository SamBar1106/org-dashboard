import { deckChip } from "../model/metrics";
import { useDisplayedFloor, useFloor, type LayerId } from "../state/store";

const LAYERS: { id: LayerId; label: string }[] = [
  { id: "mesh", label: "Mesh" },
  { id: "traces", label: "Traces" },
  { id: "telemetry", label: "Telemetry" },
];

export function DeckBar() {
  const floor = useDisplayedFloor();
  const layers = useFloor((state) => state.layers);
  const toggleLayer = useFloor((state) => state.toggleLayer);
  const resetView = useFloor((state) => state.resetView);
  return (
    <div className="deck-bar">
      <p className="deck-chip" data-testid="deck-chip">{deckChip(floor)}</p>
      <button type="button" className="text-btn" data-testid="reset-camera" onClick={resetView}>Reset Camera</button>
      <div className="layers" role="group" aria-label="Layers">
        <span>LAYERS</span>
        {LAYERS.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className="text-btn"
            data-testid={`layer-${layer.id}`}
            aria-pressed={layers[layer.id]}
            onClick={() => toggleLayer(layer.id)}
          >
            {layer.label}
          </button>
        ))}
      </div>
    </div>
  );
}
