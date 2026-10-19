import { useEffect, useMemo } from "react";
import { useCompactNav } from "./hooks";
import { fetchFloor } from "./model/fetchFloor";
import { sceneObjects } from "./model/match";
import { rejectionMessage, resolveSource } from "./model/source";
import { TOUR_STEP_MS } from "./model/tour";
import { FloorScene } from "./scene/FloorScene";
import { SceneBoundary } from "./scene/SceneBoundary";
import { useDisplayedFloor, useFloor } from "./state/store";
import { DeckBar } from "./ui/DeckBar";
import { EditPanel } from "./ui/EditPanel";
import { FilterBar } from "./ui/FilterBar";
import { FooterBar } from "./ui/FooterBar";
import { Header } from "./ui/Header";
import { HelpDialog } from "./ui/HelpDialog";
import { Inspector } from "./ui/Inspector";
import { Legend } from "./ui/Legend";
import { Drawer, Sidebar } from "./ui/Sidebar";
import { TopBar } from "./ui/TopBar";
import { Views } from "./ui/Views";

export function App() {
  const floor = useDisplayedFloor();
  const banner = useFloor((state) => state.banner);
  const nav = useFloor((state) => state.nav);
  const filter = useFloor((state) => state.filter);
  const query = useFloor((state) => state.query);
  const hiddenRacks = useFloor((state) => state.hiddenRacks);
  const tourActive = useFloor((state) => state.tourActive);
  const rolling = useFloor((state) => state.rolling);
  const framed = useFloor((state) => state.framed);
  const drawerOpen = useFloor((state) => state.drawerOpen);
  const setDrawer = useFloor((state) => state.setDrawer);
  const select = useFloor((state) => state.select);
  const compact = useCompactNav();

  useEffect(() => {
    document.title = floor.title;
  }, [floor.title]);

  useEffect(() => {
    const source = resolveSource(import.meta.env.VITE_COMMAND_FLOOR_URL);
    const rejected = rejectionMessage(source);
    if (rejected) useFloor.getState().setBanner(rejected);
    let cancel = false;
    void fetchFloor(import.meta.env.VITE_COMMAND_FLOOR_URL, "boot").then((result) => {
      if (cancel || result.kind === "skip") return;
      if (result.kind === "error") useFloor.getState().setBanner(result.message);
      if (result.kind === "floor") {
        useFloor.getState().setBanner(null);
        useFloor.getState().applyLoaded(result.floor, result.note);
      }
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!tourActive) return undefined;
    const id = window.setInterval(() => useFloor.getState().advanceTour(), TOUR_STEP_MS);
    return () => window.clearInterval(id);
  }, [tourActive]);

  useEffect(() => {
    if (!compact) setDrawer(false);
  }, [compact, setDrawer]);

  const objects = useMemo(
    () => sceneObjects(floor, filter, { query, hiddenRackIds: hiddenRacks }),
    [floor, filter, query, hiddenRacks],
  );

  return (
    <div className={compact ? "shell is-compact" : "shell"} data-compact={compact ? "true" : "false"}>
      {compact ? null : <Sidebar />}
      {compact && drawerOpen ? <Drawer onClose={() => setDrawer(false)} /> : null}
      <div className="workspace">
        {banner ? <p className="banner" role="status">{banner}</p> : null}
        <TopBar compact={compact} />
        <Header />
        {nav === "home" ? (
          <>
            <section
              className={rolling ? "viewport-card is-rolling" : "viewport-card"}
              data-testid="viewport"
              data-framed={framed ? "true" : "false"}
            >
              <DeckBar />
              <div className="canvas-wrap" role="region" aria-label="Virtual command floor. Drag to orbit. Tap a pad, rack, or agent.">
                <SceneBoundary>
                  <FloorScene />
                </SceneBoundary>
              </div>
              <Legend />
            </section>
            <FilterBar />
          </>
        ) : (
          <Views />
        )}
        <EditPanel />
        {nav === "home" ? <Inspector /> : null}
        <FooterBar />
        <HelpDialog />
        <nav className="sr-only" aria-label="Agents">
          {floor.agents.map((agent) => (
            <button key={agent.id} type="button" onClick={() => select({ kind: "pawn", id: agent.id })}>
              {agent.name}
            </button>
          ))}
        </nav>
        <div className="opacity-map" data-testid="opacity-map" hidden>
          {objects.map((item) => (
            <span key={`${item.kind}:${item.id}`} data-kind={item.kind} data-id={item.id} data-opacity={String(item.opacity)} />
          ))}
        </div>
      </div>
    </div>
  );
}
