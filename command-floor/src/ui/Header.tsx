import type { Counts, FilterId } from "../model/types";
import { useDisplayedFloor, useFloor } from "../state/store";

const PILLS: { id: Exclude<FilterId, "all">; testId: string; className: string; label: (counts: Counts) => string }[] = [
  { id: "red", testId: "pill-red", className: "pill red", label: (counts) => `${counts.red_alerts} Red Alerts` },
  { id: "waiting", testId: "pill-waiting", className: "pill blue", label: (counts) => `${counts.waiting_samuel} Waiting on Samuel` },
  { id: "prs", testId: "pill-prs", className: "pill green", label: (counts) => `${counts.open_prs} Open PRs` },
];

export function Header() {
  const floor = useDisplayedFloor();
  const filter = useFloor((state) => state.filter);
  const setFilter = useFloor((state) => state.setFilter);
  return (
    <header className="top">
      <div className="titles">
        <h1>{floor.title}</h1>
        <p className="subtitle">{floor.subtitle}</p>
        <a className="live-link" href="live.html">Live org</a>
      </div>
      <div className="pills" aria-label="Floor counts">
        {PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className={pill.className}
            data-testid={pill.testId}
            aria-pressed={filter === pill.id}
            onClick={() => setFilter(filter === pill.id ? "all" : pill.id)}
          >
            {pill.label(floor.counts)}
          </button>
        ))}
      </div>
    </header>
  );
}
