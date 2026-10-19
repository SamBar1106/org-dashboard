import { useEffect, useRef } from "react";
import { useFloor } from "../state/store";

export function HelpDialog() {
  const open = useFloor((state) => state.helpOpen);
  const setHelp = useFloor((state) => state.setHelp);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="help"
      aria-labelledby="help-title"
      onClose={() => setHelp(false)}
    >
      <h2 id="help-title">Command floor</h2>
      <ul>
        <li>Drag to orbit. Pinch or scroll to zoom.</li>
        <li>Double-click or double-tap resets the camera. WASD and the arrow keys pan.</li>
        <li>Header badges and the filter row use the same filters.</li>
        <li>Red labels shake until you click them.</li>
        <li>Simulate ED Morning Rollup tours each red or waiting item, opens it, and fires packets.</li>
        <li>Edit Floor is saved on this device only.</li>
        <li>Sound stays off until you turn it on.</li>
        <li>Mark Resolved, Dispatch Agent, Approve &amp; Run, and Live Ops need a private backend.</li>
      </ul>
      <button type="button" className="text-btn" onClick={() => setHelp(false)}>Close</button>
    </dialog>
  );
}
