import { laneSummary } from "../model/metrics";
import { useDisplayedFloor, useFloor, type NavId } from "../state/store";
import { NAV_ITEMS } from "./nav";

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const floor = useDisplayedFloor();
  const nav = useFloor((state) => state.nav);
  const setNav = useFloor((state) => state.setNav);
  const startTour = useFloor((state) => state.startTour);
  const rolling = useFloor((state) => state.rolling);
  const choose = (id: NavId) => {
    setNav(id);
    onNavigate?.();
  };
  return (
    <>
      <div className="brand-block" data-testid="brand">
        <p className="brand-kicker">Orchestrator</p>
        <p className="brand-title">Division 4</p>
      </div>
      <button type="button" className="new-run" data-testid="new-run" onClick={startTour} disabled={rolling}>
        New Run
      </button>
      <nav className="nav-list" aria-label="Floor">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="nav-item"
            data-testid={`nav-${item.id}`}
            aria-current={nav === item.id ? "page" : undefined}
            onClick={() => choose(item.id)}
          >
            <span>{item.label}</span>
            {item.id === "approvals" && floor.counts.waiting_samuel > 0 ? (
              <span className="nav-badge" data-testid="nav-badge-approvals">{floor.counts.waiting_samuel}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <p className="lane-status" data-testid="lane-status">{laneSummary(floor)}</p>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <SideNav />
    </aside>
  );
}

export function Drawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="drawer-root">
      <button type="button" className="scrim" aria-label="Close menu" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <SideNav onNavigate={onClose} />
      </aside>
    </div>
  );
}
