import { formatSpend, formatTokens, pullHref, searchHref, taskCount } from "./metrics";
import { redactPublic } from "./publicText";
import type { FloorModel, InspectorModel, InspectorTone, Level, PawnState, Selection } from "./types";

export const DEFAULT_PAD_ID = "sam-erp";

export function defaultSelection(floor: FloorModel): Selection {
  const pad = floor.project_pads.find((item) => item.id === DEFAULT_PAD_ID) ?? floor.project_pads[0];
  return { kind: "pad", id: pad ? pad.id : DEFAULT_PAD_ID };
}

export function selectionExists(floor: FloorModel, selection: Selection): boolean {
  switch (selection.kind) {
    case "pad":
      return floor.project_pads.some((pad) => pad.id === selection.id);
    case "rack":
      return floor.database_racks.some((rack) => rack.id === selection.id);
    case "pawn":
      return floor.agents.some((agent) => agent.id === selection.id);
    default: {
      const neverKind: never = selection;
      return neverKind;
    }
  }
}

export function levelTone(level: Level): InspectorTone {
  switch (level) {
    case "CRITICAL":
      return "red";
    case "WARNING":
      return "warn";
    case "HEALTHY":
      return "green";
    case "IDLE":
      return "grey";
    default: {
      const neverLevel: never = level;
      return neverLevel;
    }
  }
}

function pawnTone(state: PawnState): { level: string; tone: InspectorTone } {
  switch (state) {
    case "active":
      return { level: "ACTIVE", tone: "green" };
    case "waiting_samuel":
      return { level: "WAITING", tone: "blue" };
    case "red_alert":
      return { level: "CRITICAL", tone: "red" };
    case "idle":
      return { level: "IDLE", tone: "grey" };
    default: {
      const neverState: never = state;
      return neverState;
    }
  }
}

function show(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  return redactPublic(value);
}

function showAction(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return redactPublic(value);
}

function blank(title: string): InspectorModel {
  return {
    title,
    erp: "—",
    stage: "—",
    level: "—",
    tone: "grey",
    repos: "—",
    hosting: "—",
    status: "—",
    action: null,
    spend: formatSpend(null),
    tokens: formatTokens(null),
    tasks: 0,
    repoHref: searchHref([title]),
    prHref: searchHref([title]),
  };
}

export function toInspector(selection: Selection, floor: FloorModel): InspectorModel {
  switch (selection.kind) {
    case "pad": {
      const pad = floor.project_pads.find((item) => item.id === selection.id);
      if (!pad) return blank(selection.id);
      return {
        title: show(pad.name),
        erp: show(pad.erp_id),
        stage: show(pad.stage),
        level: pad.level,
        tone: levelTone(pad.level),
        repos: show(pad.repos_label),
        hosting: show(pad.hosting_label),
        status: show(pad.status_label),
        action: showAction(pad.action_item),
        spend: formatSpend(pad.spend_usd),
        tokens: formatTokens(pad.tokens),
        tasks: taskCount(selection, floor),
        repoHref: searchHref(pad.repos),
        prHref: pullHref(pad.repos, pad.open_pr_count),
      };
    }
    case "rack": {
      const rack = floor.database_racks.find((item) => item.id === selection.id);
      if (!rack) return blank(selection.id);
      return {
        title: show(rack.name),
        erp: show(rack.id),
        stage: show(rack.engine),
        level: rack.level,
        tone: levelTone(rack.level),
        repos: show(rack.engine),
        hosting: show(rack.host),
        status: show(rack.status_label),
        action: showAction(rack.action_item),
        spend: formatSpend(rack.spend_usd),
        tokens: formatTokens(rack.tokens),
        tasks: taskCount(selection, floor),
        repoHref: searchHref([rack.name]),
        prHref: searchHref([rack.name]),
      };
    }
    case "pawn": {
      const agent = floor.agents.find((item) => item.id === selection.id);
      if (!agent) return blank(selection.id);
      const pad = floor.project_pads.find((item) => item.id === agent.assigned_pad_id);
      const tone = pawnTone(agent.state);
      const repos = pad?.repos ?? [];
      return {
        title: show(agent.name),
        erp: show(pad?.erp_id ?? agent.id),
        stage: show(agent.role),
        level: tone.level,
        tone: tone.tone,
        repos: show(agent.bot_type),
        hosting: show(pad?.hosting_label ?? null),
        status: show(agent.status),
        action: showAction(agent.waiting_on_samuel),
        spend: formatSpend(agent.spend_usd),
        tokens: formatTokens(agent.tokens),
        tasks: taskCount(selection, floor),
        repoHref: searchHref(repos.length > 0 ? repos : [agent.name]),
        prHref: pullHref(repos, pad?.open_pr_count ?? null),
      };
    }
    default: {
      const neverSelection: never = selection;
      return neverSelection;
    }
  }
}
