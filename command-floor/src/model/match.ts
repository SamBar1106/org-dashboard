import type { FilterId, FloorModel, ObjectKind } from "./types";

export const DIMMED_OPACITY = 0.2;

export function arcId(rackId: string, padId: string): string {
  return `${rackId}::${padId}`;
}

export function arcIds(floor: FloorModel): { id: string; rackId: string; padId: string }[] {
  const links: { id: string; rackId: string; padId: string }[] = [];
  for (const pad of floor.project_pads) {
    for (const rackId of pad.connected_db_ids) links.push({ id: arcId(rackId, pad.id), rackId, padId: pad.id });
  }
  return links;
}

function matchesRed(kind: Exclude<ObjectKind, "arc">, id: string, floor: FloorModel): boolean {
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

function matchesWaiting(kind: Exclude<ObjectKind, "arc">, id: string, floor: FloorModel): boolean {
  switch (kind) {
    case "pawn":
      return floor.agents.some((agent) => agent.id === id && agent.state === "waiting_samuel");
    case "pad":
      return floor.agents.some((agent) => agent.assigned_pad_id === id && agent.state === "waiting_samuel");
    case "rack":
      return false;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function padHasOpenPrs(floor: FloorModel, padId: string | null): boolean {
  if (!padId) return false;
  const pad = floor.project_pads.find((item) => item.id === padId);
  return (pad?.open_pr_count ?? 0) > 0;
}

function matchesPrs(kind: Exclude<ObjectKind, "arc">, id: string, floor: FloorModel): boolean {
  switch (kind) {
    case "pad":
      return padHasOpenPrs(floor, id);
    case "pawn": {
      const agent = floor.agents.find((item) => item.id === id);
      return padHasOpenPrs(floor, agent?.assigned_pad_id ?? null);
    }
    case "rack":
      return floor.project_pads.some((pad) => (pad.open_pr_count ?? 0) > 0 && pad.connected_db_ids.includes(id));
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function matchesKind(kind: Exclude<ObjectKind, "arc">, id: string, filter: Exclude<FilterId, "all">, floor: FloorModel): boolean {
  switch (filter) {
    case "red":
      return matchesRed(kind, id, floor);
    case "waiting":
      return matchesWaiting(kind, id, floor);
    case "prs":
      return matchesPrs(kind, id, floor);
    default: {
      const neverFilter: never = filter;
      return neverFilter;
    }
  }
}

export function matches(kind: ObjectKind, id: string, filter: FilterId, floor: FloorModel): boolean {
  if (filter === "all") return true;
  if (kind === "arc") {
    const [rackId, padId] = id.split("::");
    if (!rackId || !padId) return false;
    return matchesKind("rack", rackId, filter, floor) || matchesKind("pad", padId, filter, floor);
  }
  return matchesKind(kind, id, filter, floor);
}

export interface MatchOptions {
  query?: string;
  hiddenRackIds?: readonly string[];
}

function haystack(kind: ObjectKind, id: string, floor: FloorModel): string {
  switch (kind) {
    case "pad": {
      const pad = floor.project_pads.find((item) => item.id === id);
      if (!pad) return id;
      return [pad.name, pad.stage, pad.status_label, pad.repos_label, pad.hosting_label, ...pad.repos].join(" ");
    }
    case "rack": {
      const rack = floor.database_racks.find((item) => item.id === id);
      if (!rack) return id;
      return [rack.name, rack.engine, rack.host, rack.status_label].join(" ");
    }
    case "pawn": {
      const agent = floor.agents.find((item) => item.id === id);
      if (!agent) return id;
      return [agent.name, agent.role, agent.bot_type, agent.status, agent.waiting_on_samuel ?? ""].join(" ");
    }
    case "arc": {
      const [rackId, padId] = id.split("::");
      return `${haystack("rack", rackId ?? "", floor)} ${haystack("pad", padId ?? "", floor)}`;
    }
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function matchesQuery(kind: ObjectKind, id: string, floor: FloorModel, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack(kind, id, floor).toLowerCase().includes(needle);
}

function hiddenArc(id: string, hiddenRackIds: readonly string[] | undefined): boolean {
  if (!hiddenRackIds || hiddenRackIds.length === 0) return false;
  const rackId = id.split("::")[0];
  return rackId ? hiddenRackIds.includes(rackId) : false;
}

export function objectOpacity(kind: ObjectKind, id: string, filter: FilterId, floor: FloorModel, options?: MatchOptions): number {
  if (kind === "arc" && hiddenArc(id, options?.hiddenRackIds)) return 0;
  const visible = matches(kind, id, filter, floor) && matchesQuery(kind, id, floor, options?.query ?? "");
  return visible ? 1 : DIMMED_OPACITY;
}

export interface SceneObjectRef {
  kind: ObjectKind;
  id: string;
  opacity: number;
}

export function sceneObjects(floor: FloorModel, filter: FilterId, options?: MatchOptions): SceneObjectRef[] {
  const items: { kind: ObjectKind; id: string }[] = [
    ...floor.project_pads.map((pad) => ({ kind: "pad" as const, id: pad.id })),
    ...floor.database_racks.map((rack) => ({ kind: "rack" as const, id: rack.id })),
    ...floor.agents.map((agent) => ({ kind: "pawn" as const, id: agent.id })),
    ...arcIds(floor).map((arc) => ({ kind: "arc" as const, id: arc.id })),
  ];
  return items.map((item) => ({ ...item, opacity: objectOpacity(item.kind, item.id, filter, floor, options) }));
}
