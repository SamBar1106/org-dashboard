import { fetchFloor } from "../model/fetchFloor";
import { liveOpsReady } from "../model/liveOps";
import { useFloor, type OpsMode } from "../state/store";

const LIVE_NOTE = "Live Ops stays off until a private https API with login exists.";

export function FooterBar() {
  const muted = useFloor((state) => state.muted);
  const setMuted = useFloor((state) => state.setMuted);
  const opsMode = useFloor((state) => state.opsMode);
  const setOpsMode = useFloor((state) => state.setOpsMode);
  const applyLoaded = useFloor((state) => state.applyLoaded);
  const setBanner = useFloor((state) => state.setBanner);
  const ready = liveOpsReady(import.meta.env.VITE_COMMAND_FLOOR_URL, import.meta.env.VITE_COMMAND_FLOOR_LOGIN_URL);

  async function choose(mode: OpsMode) {
    if (mode === "live" && !ready) return;
    setOpsMode(mode);
    if (mode !== "live") return;
    const result = await fetchFloor(import.meta.env.VITE_COMMAND_FLOOR_URL, "ping");
    if (result.kind === "error") setBanner(result.message);
    if (result.kind === "floor") {
      setBanner(null);
      applyLoaded(result.floor, "Live Ops");
    }
  }

  return (
    <footer className="footer-bar">
      <div className="ops-toggle" role="group" aria-label="Data mode">
        <button type="button" data-testid="mode-public" aria-pressed={opsMode === "public"} onClick={() => void choose("public")}>Public</button>
        <button
          type="button"
          data-testid="mode-live"
          aria-pressed={opsMode === "live"}
          disabled={!ready}
          title={ready ? "Use the private API" : LIVE_NOTE}
          onClick={() => void choose("live")}
        >
          Live Ops
        </button>
      </div>
      <button
        type="button"
        className="text-btn"
        data-testid="sound-toggle"
        aria-pressed={!muted}
        onClick={() => setMuted(!muted)}
      >
        {muted ? "Sound off" : "Sound on"}
      </button>
      <p className="privacy">Public view: generic system labels only. No client data.</p>
      {ready ? null : <p className="ops-note">{LIVE_NOTE}</p>}
    </footer>
  );
}
