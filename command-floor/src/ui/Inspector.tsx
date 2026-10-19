import { toInspector } from "../model/inspector";
import { useDisplayedFloor, useFloor } from "../state/store";

export function Inspector() {
  const floor = useDisplayedFloor();
  const selection = useFloor((state) => state.selection);
  const resetSelection = useFloor((state) => state.resetSelection);
  const model = toInspector(selection, floor);
  return (
    <section className="inspector" aria-label="Selection details">
      <div className="inspector-head">
        <div>
          <h2 data-testid="inspector-title">{model.title}</h2>
          <p className="inspector-tags">
            <span className="tag" data-testid="samuel-ai">Samuel + AI</span>
            <span className="cost" data-testid="inspector-cost">{model.spend} · {model.tokens}</span>
          </p>
        </div>
        <button type="button" className="close" onClick={resetSelection} aria-label="Reset inspector">×</button>
      </div>
      <p className="meta">
        {model.erp} • {model.stage} • Level: <span className={`tone-${model.tone}`}>{model.level}</span>
      </p>
      <div className="cols">
        <div className="col">
          <span>REPOS</span>
          <strong>{model.repos}</strong>
        </div>
        <div className="col">
          <span>HOSTING</span>
          <strong>{model.hosting}</strong>
        </div>
        <div className="col">
          <span>STATUS</span>
          <strong><i className={`dot tone-${model.tone}`} /> {model.status}</strong>
        </div>
      </div>
      <p className="tasks" data-testid="task-count">{model.tasks} {model.tasks === 1 ? "task" : "tasks"}</p>
      {model.action ? (
        <div className="action">
          <span>WAITING ON SAMUEL ACTION ITEM</span>
          <p>{model.action}</p>
          <div className="action-row">
            <button type="button" className="is-locked" data-testid="approve-run" disabled title="needs private backend">Approve &amp; Run</button>
            <a data-testid="inspect-pr" href={model.prHref} target="_blank" rel="noreferrer">Inspect PR</a>
          </div>
        </div>
      ) : null}
      <div className="inspector-actions">
        <a data-testid="open-repo" href={model.repoHref} target="_blank" rel="noreferrer">Open Repo/PR</a>
        <button type="button" className="is-locked" data-testid="mark-resolved" disabled title="needs private backend">Mark Resolved</button>
        <button type="button" className="is-locked" data-testid="dispatch-agent" disabled title="needs private backend">Dispatch Agent</button>
      </div>
      <p className="private-note" data-testid="private-note">needs private backend</p>
    </section>
  );
}
