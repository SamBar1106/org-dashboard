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

export function objectOpacity(kind: ObjectKind, id: string, filter: FilterId, floor: FloorModel): number {
  return matches(kind, id, filter, floor) ? 1 : DIMMED_OPACITY;
}

export interface SceneObjectRef {
  kind: ObjectKind;
  id: string;
  opacity: number;
}

export function sceneObjects(floor: FloorModel, filter: FilterId): SceneObjectRef[] {
  const items: { kind: ObjectKind; id: string }[] = [
    ...floor.project_pads.map((pad) => ({ kind: "pad" as const, id: pad.id })),
    ...floor.database_racks.map((rack) => ({ kind: "rack" as const, id: rack.id })),
    ...floor.agents.map((agent) => ({ kind: "pawn" as const, id: agent.id })),
    ...arcIds(floor).map((arc) => ({ kind: "arc" as const, id: arc.id })),
  ];
  return items.map((item) => ({ ...item, opacity: objectOpacity(item.kind, item.id, filter, floor) }));
}
