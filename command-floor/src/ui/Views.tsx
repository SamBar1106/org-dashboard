import { arcIds } from "../model/match";
import { liveOpsReady } from "../model/liveOps";
import { useDisplayedFloor, useFloor, type RangeId } from "../state/store";
import { MAX_DPR } from "../scene/quality";
import { presentScene } from "../scene/present";

export function Views() {
  const nav = useFloor((state) => state.nav);
  switch (nav) {
    case "home":
      return null;
    case "traces":
      return <Traces />;
    case "graph":
      return <TraceGraph />;
    case "timeline":
      return <Timeline />;
    case "procedures":
      return <Procedures />;
    case "approvals":
      return <Approvals />;
    case "agents":
      return <Agents />;
    case "settings":
      return <Settings />;
    default: {
      const neverNav: never = nav;
      return neverNav;
    }
  }
}

function Traces() {
  const floor = useDisplayedFloor();
  const links = arcIds(floor);
  return (
    <section className="view-card">
      <h2>Traces ({links.length})</h2>
      {links.map((link) => {
        const pad = floor.project_pads.find((item) => item.id === link.padId);
        const rack = floor.database_racks.find((item) => item.id === link.rackId);
        return (
          <p key={link.id} className="trace-row">
            <i className="dot" style={{ background: pad?.pad_color ?? "#5cefff" }} />
            {rack?.name ?? link.rackId} → {pad?.name ?? link.padId}
          </p>
        );
      })}
    </section>
  );
}

function TraceGraph() {
  const floor = useDisplayedFloor();
  const presented = presentScene(floor);
  const points = [...presented.pads.values(), ...presented.racks.values()];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const mapX = (x: number) => 8 + ((x - minX) / span) * 84;
  const mapZ = (z: number) => 8 + ((z - minZ) / span) * 84;
  return (
    <section className="view-card">
      <h2>Trace graph</h2>
      <svg className="trace-graph" viewBox="0 0 100 100" role="img" aria-label="Pads around the data vault">
        {floor.project_pads.map((pad) => {
          const padAt = presented.pads.get(pad.id);
          if (!padAt) return null;
          return pad.connected_db_ids.map((rackId) => {
            const rackAt = presented.racks.get(rackId);
            if (!rackAt) return null;
            return (
              <line
                key={`${rackId}-${pad.id}`}
                x1={mapX(rackAt.x)}
                y1={mapZ(rackAt.z)}
                x2={mapX(padAt.x)}
                y2={mapZ(padAt.z)}
                stroke={pad.pad_color}
                strokeDasharray="1.2 0.8"
                strokeWidth="0.4"
              />
            );
          });
        })}
        {floor.database_racks.map((rack) => {
          const at = presented.racks.get(rack.id);
          if (!at) return null;
          return <circle key={rack.id} cx={mapX(at.x)} cy={mapZ(at.z)} r="1.6" fill="#9ec1ff" />;
        })}
        {floor.project_pads.map((pad) => {
          const at = presented.pads.get(pad.id);
          if (!at) return null;
          return <circle key={pad.id} cx={mapX(at.x)} cy={mapZ(at.z)} r="2.1" fill={pad.pad_color} />;
        })}
      </svg>
    </section>
  );
}

function rangeLabel(range: RangeId): string {
  switch (range) {
    case "today":
      return "Today";
    case "7d":
      return "7d";
    case "30d":
      return "30d";
    default: {
      const neverRange: never = range;
      return neverRange;
    }
  }
}

function Timeline() {
  const floor = useDisplayedFloor();
  const range = useFloor((state) => state.range);
  return (
    <section className="view-card">
      <h2>Timeline · {rangeLabel(range)}</h2>
      <p className="muted">This seed has no per-item times, so Today, 7d, and 30d list the same rows.</p>
      {floor.checks.checked_at ? <p className="muted">Last refresh {floor.checks.checked_at}</p> : null}
      {floor.project_pads.map((pad) => (
        <p key={pad.id} className="trace-row">{pad.name} · {pad.level} · {pad.stage}</p>
      ))}
      {floor.agents.map((agent) => (
        <p key={agent.id} className="trace-row">{agent.name} · {agent.state}</p>
      ))}
    </section>
  );
}

function Procedures() {
  const floor = useDisplayedFloor();
  const rows = [
    ...floor.project_pads.filter((pad) => pad.action_item).map((pad) => ({ id: pad.id, title: pad.name, detail: pad.action_item ?? "" })),
    ...floor.database_racks.filter((rack) => rack.action_item).map((rack) => ({ id: rack.id, title: rack.name, detail: rack.action_item ?? "" })),
    ...floor.agents.filter((agent) => agent.waiting_on_samuel).map((agent) => ({ id: agent.id, title: agent.name, detail: agent.waiting_on_samuel ?? "" })),
  ];
  return (
    <section className="view-card">
      <h2>Procedures ({rows.length})</h2>
      {rows.map((row) => (
        <p key={row.id} className="trace-row"><strong>{row.title}</strong> — {row.detail}</p>
      ))}
    </section>
  );
}

function Approvals() {
  const floor = useDisplayedFloor();
  const select = useFloor((state) => state.select);
  const waiting = floor.agents.filter((agent) => agent.state === "waiting_samuel");
  return (
    <section className="view-card">
      <h2>Approvals ({waiting.length})</h2>
      {waiting.length === 0 ? <p className="muted">No approvals waiting.</p> : null}
      {waiting.map((agent) => (
        <button key={agent.id} type="button" className="trace-button" onClick={() => select({ kind: "pawn", id: agent.id })}>
          <strong>{agent.name}</strong>
          <span>{agent.waiting_on_samuel ?? agent.status}</span>
        </button>
      ))}
    </section>
  );
}

function Agents() {
  const floor = useDisplayedFloor();
  const select = useFloor((state) => state.select);
  return (
    <section className="view-card">
      <h2>Agents ({floor.agents.length})</h2>
      {floor.agents.map((agent) => (
        <button key={agent.id} type="button" className="trace-button" onClick={() => select({ kind: "pawn", id: agent.id })}>
          <strong>{agent.name}</strong>
          <span>{agent.state} · {agent.role}</span>
        </button>
      ))}
    </section>
  );
}

function Settings() {
  const floor = useDisplayedFloor();
  const ready = liveOpsReady(import.meta.env.VITE_COMMAND_FLOOR_URL, import.meta.env.VITE_COMMAND_FLOOR_LOGIN_URL);
  return (
    <section className="view-card">
      <h2>Settings</h2>
      <p>Pixel ratio cap {MAX_DPR}. Sound stays off until the footer control is used.</p>
      <p>Edit Floor writes to this browser only. Export JSON downloads that copy.</p>
      <p>{ready ? "A private https API with login is configured." : "Live Ops stays off until a private https API with login exists."}</p>
      <p>Checks: postgres {floor.checks.postgres}, loom {floor.checks.loom}, github {floor.checks.github}.</p>
    </section>
  );
}
