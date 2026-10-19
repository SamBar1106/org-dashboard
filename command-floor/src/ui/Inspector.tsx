import type { InspectorModel } from "../model/types";

interface InspectorProps {
  model: InspectorModel;
  onReset: () => void;
}

export function Inspector({ model, onReset }: InspectorProps) {
  return (
    <section className="inspector" aria-label="Selection details">
      <div className="inspector-head">
        <h2 data-testid="inspector-title">{model.title}</h2>
        <button type="button" className="close" onClick={onReset} aria-label="Reset inspector">×</button>
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
      {model.action ? (
        <div className="action">
          <span>WAITING ON SAMUEL ACTION ITEM</span>
          <p>{model.action}</p>
        </div>
      ) : null}
    </section>
  );
}
