import type { Counts } from "../model/types";

interface HeaderProps {
  title: string;
  subtitle: string;
  counts: Counts;
}

export function Header({ title, subtitle, counts }: HeaderProps) {
  return (
    <header className="top">
      <div className="titles">
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
        <a className="live-link" href="live.html">Live org</a>
      </div>
      <div className="pills" aria-label="Floor counts">
        <span className="pill red" data-testid="pill-red">{counts.red_alerts} Red Alerts</span>
        <span className="pill blue" data-testid="pill-waiting">{counts.waiting_samuel} Waiting on Samuel</span>
        <span className="pill green" data-testid="pill-prs">{counts.open_prs} Open PRs</span>
      </div>
    </header>
  );
}
