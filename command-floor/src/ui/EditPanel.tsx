import { useState } from "react";
import { toExportDocument } from "../model/edits";
import { useDisplayedFloor, useFloor } from "../state/store";

export function EditPanel() {
  const editMode = useFloor((state) => state.editMode);
  const floor = useDisplayedFloor();
  const selection = useFloor((state) => state.selection);
  const setPadColor = useFloor((state) => state.setPadColor);
  const addPad = useFloor((state) => state.addPad);
  const addAgent = useFloor((state) => state.addAgent);
  const addArc = useFloor((state) => state.addArc);
  const [deskName, setDeskName] = useState("");
  const [deskColor, setDeskColor] = useState("#3b82f6");
  const [agentName, setAgentName] = useState("");
  const [agentPad, setAgentPad] = useState(floor.project_pads[0]?.id ?? "");
  const [arcPad, setArcPad] = useState(floor.project_pads[0]?.id ?? "");
  const [arcRack, setArcRack] = useState(floor.database_racks[0]?.id ?? "");
  const [error, setError] = useState("");
  if (!editMode) return null;
  const selectedPad = selection.kind === "pad" ? floor.project_pads.find((pad) => pad.id === selection.id) : undefined;

  function onExport() {
    const blob = new Blob([JSON.stringify(toExportDocument(floor), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "command-floor-local.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="edit-panel" data-testid="edit-panel" aria-label="Edit floor">
      <div className="edit-head">
        <h2>Edit Floor</h2>
        <p>Saved on this device only.</p>
      </div>
      {selectedPad ? (
        <label>
          Pad color
          <input
            data-testid="pad-color"
            type="color"
            value={normalizeColor(selectedPad.pad_color)}
            onChange={(event) => setPadColor(selectedPad.id, event.target.value)}
          />
        </label>
      ) : null}
      <div className="edit-grid">
        <label>
          Desk name
          <input data-testid="desk-name" value={deskName} onChange={(event) => setDeskName(event.target.value)} />
        </label>
        <label>
          Desk color
          <input data-testid="desk-color" type="color" value={deskColor} onChange={(event) => setDeskColor(event.target.value)} />
        </label>
        <button
          type="button"
          className="text-btn"
          data-testid="add-desk"
          onClick={() => setError(addPad(deskName, deskColor) ? "" : "That desk could not be added.")}
        >
          Add desk
        </button>
        <label>
          Agent name
          <input data-testid="agent-name" value={agentName} onChange={(event) => setAgentName(event.target.value)} />
        </label>
        <label>
          Assign to
          <select data-testid="agent-pad" value={agentPad} onChange={(event) => setAgentPad(event.target.value)}>
            {floor.project_pads.map((pad) => <option key={pad.id} value={pad.id}>{pad.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="text-btn"
          data-testid="add-agent"
          onClick={() => setError(addAgent(agentName, agentPad) ? "" : "That agent could not be added.")}
        >
          Add agent
        </button>
        <label>
          Arc from
          <select data-testid="arc-pad" value={arcPad} onChange={(event) => setArcPad(event.target.value)}>
            {floor.project_pads.map((pad) => <option key={pad.id} value={pad.id}>{pad.name}</option>)}
          </select>
        </label>
        <label>
          Arc to
          <select data-testid="arc-rack" value={arcRack} onChange={(event) => setArcRack(event.target.value)}>
            {floor.database_racks.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="text-btn"
          data-testid="add-arc"
          onClick={() => setError(addArc(arcPad, arcRack) ? "" : "That arc is already on the floor.")}
        >
          Add arc
        </button>
      </div>
      {error ? <p className="edit-error" data-testid="edit-error">{error}</p> : null}
      <button type="button" className="text-btn" data-testid="export-json" onClick={onExport}>Export JSON</button>
    </section>
  );
}

function normalizeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#3b82f6";
}
