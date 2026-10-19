import type { FloorModel, Selection } from "./types";
import { sensitiveKind } from "./publicText";

const TERM = /^[A-Za-z0-9._-]+$/;

export function deckStats(floor: FloorModel): { activePads: number; dataHubs: number } {
  return {
    activePads: floor.project_pads.filter((pad) => pad.level !== "IDLE").length,
    dataHubs: floor.database_racks.length,
  };
}

export function deckChip(floor: FloorModel): string {
  const stats = deckStats(floor);
  return `COMMAND DECK • ${stats.activePads} Active Pads • ${stats.dataHubs} Data Hubs`;
}

export function laneSummary(floor: FloorModel): string {
  const lanes = floor.agents.length;
  const active = floor.agents.filter((agent) => agent.state === "active").length;
  if (lanes === 0) return "No lanes";
  if (active === lanes) return `All ${lanes} Lanes Active`;
  return `${active} of ${lanes} Lanes Active`;
}

export function formatSpend(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "$—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function formatTokens(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "— tokens";
  return `${new Intl.NumberFormat("en-US").format(value)} tokens`;
}

export function taskCount(selection: Selection, floor: FloorModel): number {
  switch (selection.kind) {
    case "pad": {
      const pad = floor.project_pads.find((item) => item.id === selection.id);
      if (!pad) return 0;
      const waiting = floor.agents.filter((agent) => agent.assigned_pad_id === pad.id && agent.state === "waiting_samuel").length;
      return (pad.open_pr_count ?? 0) + (pad.action_item ? 1 : 0) + waiting;
    }
    case "rack": {
      const rack = floor.database_racks.find((item) => item.id === selection.id);
      if (!rack) return 0;
      const linked = floor.project_pads.filter((pad) => pad.connected_db_ids.includes(rack.id) && pad.action_item).length;
      return (rack.action_item ? 1 : 0) + linked;
    }
    case "pawn": {
      const agent = floor.agents.find((item) => item.id === selection.id);
      if (!agent) return 0;
      const waiting = agent.state === "waiting_samuel" || agent.waiting_on_samuel ? 1 : 0;
      const alert = agent.state === "red_alert" ? 1 : 0;
      return waiting + alert;
    }
    default: {
      const neverKind: never = selection;
      return neverKind;
    }
  }
}

function terms(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0 && TERM.test(value) && !sensitiveKind(value));
}

export function searchHref(values: string[]): string {
  const query = terms(values)[0] ?? "repository";
  return `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`;
}

export function pullHref(values: string[], openPrs: number | null): string {
  const name = terms(values)[0];
  if (name && (openPrs ?? 0) > 0) {
    return `https://github.com/search?q=${encodeURIComponent(`${name} is:pr is:open`)}&type=pullrequests`;
  }
  return searchHref(values);
}

export function isRedAlert(kind: Selection["kind"], id: string, floor: FloorModel): boolean {
  switch (kind) {
    case "pad":
      return floor.project_pads.some((pad) => pad.id === id && pad.level === "CRITICAL");
    case "rack":
      return floor.database_racks.some((rack) => rack.id === id && rack.level === "CRITICAL");
    case "pawn":
      return floor.agents.some((agent) => agent.id === id && agent.state === "red_alert");
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}
