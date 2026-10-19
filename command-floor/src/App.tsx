import { useEffect, useMemo, useState } from "react";
import { usePageHidden, useReducedMotion } from "./hooks";
import { defaultSelection, selectionExists, toInspector } from "./model/inspector";
import { getBundledFloor, refreshedSeed } from "./model/load";
import { sceneObjects } from "./model/match";
import { rejectionMessage, resolveSource, simulateEndpoint } from "./model/source";
import { floorFromUnknown } from "./model/validate";
import type { FilterId, FloorModel, Selection } from "./model/types";
import { FloorScene } from "./scene/FloorScene";
import { SceneBoundary } from "./scene/SceneBoundary";
import { FilterBar } from "./ui/FilterBar";
import { Header } from "./ui/Header";
import { Inspector } from "./ui/Inspector";
import { Legend } from "./ui/Legend";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function App() {
  const initial = useMemo(() => getBundledFloor(), []);
  const [floor, setFloor] = useState<FloorModel>(initial);
  const [filter, setFilter] = useState<FilterId>("all");
  const [selection, setSelection] = useState<Selection>(() => defaultSelection(initial));
  const [rolling, setRolling] = useState(false);
  const [note, setNote] = useState("Static seed · checks not run");
  const [banner, setBanner] = useState<string | null>(null);
  const [framed, setFramed] = useState(false);
  const hidden = usePageHidden();
  const reduce = useReducedMotion();

  useEffect(() => {
    document.title = floor.title;
  }, [floor.title]);

  useEffect(() => {
    const source = resolveSource(import.meta.env.VITE_COMMAND_FLOOR_URL);
    const rejected = rejectionMessage(source);
    if (rejected) setBanner(rejected);
    if (source.kind !== "remote") return undefined;
    let cancel = false;
    fetch(source.url)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return floorFromUnknown(await response.json());
      })
      .then((next) => {
        if (cancel) return;
        setFloor(next);
        setSelection((current) => (selectionExists(next, current) ? current : defaultSelection(next)));
        setNote("Live source loaded");
      })
      .catch(() => {
        if (!cancel) setBanner("Live source unavailable. Showing the published seed.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function onRollup() {
    if (rolling) return;
    setRolling(true);
    const started = performance.now();
    let next = refreshedSeed();
    let message = "Seed refreshed · checks not run";
    const source = resolveSource(import.meta.env.VITE_COMMAND_FLOOR_URL);
    if (source.kind === "remote") {
      const endpoint = simulateEndpoint(source.url);
      if (endpoint) {
        try {
          const response = await fetch(endpoint, { method: "POST" });
          if (!response.ok) throw new Error(String(response.status));
          next = floorFromUnknown(await response.json());
          message = "Rollup loaded from the configured source";
        } catch {
          message = "Seed refreshed · remote rollup unavailable";
        }
      }
    }
    const elapsed = performance.now() - started;
    if (elapsed < 900) await delay(900 - elapsed);
    setFloor(next);
    setSelection((current) => (selectionExists(next, current) ? current : defaultSelection(next)));
    setNote(message);
    setRolling(false);
  }

  const objects = useMemo(() => sceneObjects(floor, filter), [floor, filter]);
  const inspector = toInspector(selection, floor);
  const frameloop = hidden ? "never" : rolling || !reduce ? "always" : "demand";
  const animate = !hidden && (rolling || !reduce);

  return (
    <div className="app">
      {banner ? <p className="banner" role="status">{banner}</p> : null}
      <Header title={floor.title} subtitle={floor.subtitle} counts={floor.counts} />
      <section
        className={rolling ? "viewport-card is-rolling" : "viewport-card"}
        data-testid="viewport"
        data-framed={framed ? "true" : "false"}
      >
        <div className="canvas-wrap" role="region" aria-label="Virtual command floor. Drag to orbit. Tap a pad, rack, or agent.">
          <SceneBoundary>
            <FloorScene
              floor={floor}
              filter={filter}
              selection={selection}
              animate={animate}
              rolling={rolling}
              frameloop={frameloop}
              onSelect={setSelection}
              onFrame={() => setFramed(true)}
            />
          </SceneBoundary>
        </div>
        <Legend racks={floor.database_racks} />
      </section>
      <FilterBar counts={floor.counts} filter={filter} rolling={rolling} note={note} onFilter={setFilter} onRollup={() => void onRollup()} />
      <Inspector model={inspector} onReset={() => setSelection(defaultSelection(floor))} />
      <p className="privacy">Public view: generic system labels only. No client data.</p>
      <nav className="sr-only" aria-label="Agents">
        {floor.agents.map((agent) => (
          <button key={agent.id} type="button" onClick={() => setSelection({ kind: "pawn", id: agent.id })}>
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
  );
}
