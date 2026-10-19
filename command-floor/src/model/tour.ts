import { arcIds } from "./match";
import type { FloorModel, Selection } from "./types";

export const TOUR_STEP_MS = 4000;

export interface TourStop {
  selection: Selection;
  arcIds: string[];
}

export function arcsForSelection(floor: FloorModel, selection: Selection): string[] {
  const links = arcIds(floor);
  switch (selection.kind) {
    case "pad":
      return links.filter((arc) => arc.padId === selection.id).map((arc) => arc.id);
    case "rack":
      return links.filter((arc) => arc.rackId === selection.id).map((arc) => arc.id);
    case "pawn": {
      const agent = floor.agents.find((item) => item.id === selection.id);
      return links.filter((arc) => arc.padId === agent?.assigned_pad_id).map((arc) => arc.id);
    }
    default: {
      const neverKind: never = selection;
      return neverKind;
    }
  }
}

/** Red items first, then agents waiting on Samuel. Counts come from the floor. */
export function tourStops(floor: FloorModel): TourStop[] {
  const stops: TourStop[] = [];
  for (const pad of floor.project_pads) {
    if (pad.level === "CRITICAL") stops.push({ selection: { kind: "pad", id: pad.id }, arcIds: arcsForSelection(floor, { kind: "pad", id: pad.id }) });
  }
  for (const rack of floor.database_racks) {
    if (rack.level === "CRITICAL") stops.push({ selection: { kind: "rack", id: rack.id }, arcIds: arcsForSelection(floor, { kind: "rack", id: rack.id }) });
  }
  for (const agent of floor.agents) {
    if (agent.state === "red_alert") {
      stops.push({ selection: { kind: "pawn", id: agent.id }, arcIds: arcsForSelection(floor, { kind: "pawn", id: agent.id }) });
    }
  }
  for (const agent of floor.agents) {
    if (agent.state === "waiting_samuel") {
      stops.push({ selection: { kind: "pawn", id: agent.id }, arcIds: arcsForSelection(floor, { kind: "pawn", id: agent.id }) });
    }
  }
  return stops;
}

export function tourWalkIds(floor: FloorModel, stop: TourStop): string[] {
  switch (stop.selection.kind) {
    case "pawn":
      return [stop.selection.id];
    case "pad":
      return floor.agents.filter((agent) => agent.assigned_pad_id === stop.selection.id).map((agent) => agent.id);
    case "rack":
      return floor.agents.filter((agent) => {
        const pad = floor.project_pads.find((item) => item.id === agent.assigned_pad_id);
        return pad ? pad.connected_db_ids.includes(stop.selection.id) : false;
      }).map((agent) => agent.id);
    default: {
      const neverKind: never = stop.selection;
      return neverKind;
    }
  }
}
