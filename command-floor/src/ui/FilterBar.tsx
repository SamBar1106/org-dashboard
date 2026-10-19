import { fetchFloor } from "../model/fetchFloor";
import type { Counts, FilterId } from "../model/types";
import { useDisplayedFloor, useFloor } from "../state/store";

const FILTERS: { id: FilterId; label: (counts: Counts) => string }[] = [
  { id: "all", label: (counts) => `All Ecosystem (${counts.total})` },
  { id: "red", label: (counts) => `Red Alerts (${counts.red_alerts})` },
  { id: "waiting", label: (counts) => `Waiting on Samuel (${counts.waiting_samuel})` },
  { id: "prs", label: (counts) => `Open PRs (${counts.open_prs})` },
];

export function FilterBar() {
  const floor = useDisplayedFloor();
  const filter = useFloor((state) => state.filter);
  const setFilter = useFloor((state) => state.setFilter);
  const rolling = useFloor((state) => state.rolling);
  const note = useFloor((state) => state.note);
  const startTour = useFloor((state) => state.startTour);
  const applyLoaded = useFloor((state) => state.applyLoaded);
  const setBanner = useFloor((state) => state.setBanner);

  async function onPing() {
    const result = await fetchFloor(import.meta.env.VITE_COMMAND_FLOOR_URL, "ping");
    if (result.kind === "error") {
      setBanner(result.message);
      return;
    }
    if (result.kind === "floor") {
      setBanner(null);
      applyLoaded(result.floor, result.note);
    }
  }

  return (
    <div className="filter-block">
      <div className="filters" role="toolbar" aria-label="Filter the floor">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="filter"
            data-testid={`filter-${item.id}`}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label(floor.counts)}
          </button>
        ))}
        <button type="button" className="rollup ping" data-testid="live-ping" onClick={() => void onPing()}>
          Live Ping / Refresh
        </button>
        <button type="button" className="rollup" data-testid="rollup" onClick={startTour} disabled={rolling} aria-busy={rolling}>
          <span aria-hidden="true" className="play">{rolling ? "◌" : "▶"}</span>
          {rolling ? "Touring the floor…" : "Simulate ED Morning Rollup"}
        </button>
      </div>
      <p className="note" data-testid="rollup-note">{note}</p>
    </div>
  );
}
