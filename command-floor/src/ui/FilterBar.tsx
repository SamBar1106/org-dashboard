import type { Counts, FilterId } from "../model/types";

interface FilterBarProps {
  counts: Counts;
  filter: FilterId;
  rolling: boolean;
  note: string;
  onFilter: (filter: FilterId) => void;
  onRollup: () => void;
}

const FILTERS: { id: FilterId; label: (counts: Counts) => string }[] = [
  { id: "all", label: (counts) => `All Ecosystem (${counts.total})` },
  { id: "red", label: (counts) => `Red Alerts (${counts.red_alerts})` },
  { id: "waiting", label: (counts) => `Waiting on Samuel (${counts.waiting_samuel})` },
  { id: "prs", label: (counts) => `Open PRs (${counts.open_prs})` },
];

export function FilterBar({ counts, filter, rolling, note, onFilter, onRollup }: FilterBarProps) {
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
            onClick={() => onFilter(item.id)}
          >
            {item.label(counts)}
          </button>
        ))}
        <button type="button" className="rollup" data-testid="rollup" onClick={onRollup} disabled={rolling} aria-busy={rolling}>
          <span aria-hidden="true" className="play">{rolling ? "◌" : "▶"}</span>
          {rolling ? "Refreshing seed…" : "Simulate ED Morning Rollup"}
        </button>
      </div>
      <p className="note" data-testid="rollup-note">{note}</p>
    </div>
  );
}
