import { useDisplayedFloor, useFloor, type RangeId } from "../state/store";

const RANGES: { id: RangeId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

export function TopBar({ compact }: { compact: boolean }) {
  const floor = useDisplayedFloor();
  const range = useFloor((state) => state.range);
  const setRange = useFloor((state) => state.setRange);
  const query = useFloor((state) => state.query);
  const setQuery = useFloor((state) => state.setQuery);
  const reviewAll = useFloor((state) => state.reviewAll);
  const editMode = useFloor((state) => state.editMode);
  const setEditMode = useFloor((state) => state.setEditMode);
  const setFilter = useFloor((state) => state.setFilter);
  const drawerOpen = useFloor((state) => state.drawerOpen);
  const setDrawer = useFloor((state) => state.setDrawer);
  const setHelp = useFloor((state) => state.setHelp);
  return (
    <div className="topbar">
      {compact ? (
        <button
          type="button"
          className="icon-btn"
          data-testid="nav-menu"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawer(true)}
        >
          ☰
        </button>
      ) : null}
      <div className="range" role="group" aria-label="Time range">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`range-${item.id}`}
            aria-pressed={range === item.id}
            onClick={() => setRange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <input
        className="search"
        data-testid="floor-search"
        type="search"
        placeholder="Search the floor"
        aria-label="Search the floor"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button type="button" className="text-btn" data-testid="review-all" onClick={reviewAll}>Review All</button>
      <button
        type="button"
        className="text-btn edit-toggle"
        data-testid="edit-floor"
        aria-pressed={editMode}
        onClick={() => setEditMode(!editMode)}
      >
        Edit Floor
      </button>
      <button
        type="button"
        className="icon-btn"
        data-testid="alerts-bell"
        aria-label={`Red alerts: ${floor.counts.red_alerts}`}
        onClick={() => setFilter("red")}
      >
        <span aria-hidden="true">🔔</span>
        {floor.counts.red_alerts > 0 ? <span className="nav-badge">{floor.counts.red_alerts}</span> : null}
      </button>
      <button type="button" className="icon-btn" data-testid="help-button" aria-label="Help" onClick={() => setHelp(true)}>?</button>
      <span className="avatar" data-testid="avatar" aria-label="Account">S</span>
    </div>
  );
}
