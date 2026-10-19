import { create } from "zustand";
import { applyEdits, createAgent, createArc, createPad, loadEdits, recolorPad, saveEdits, type FloorEdits } from "../model/edits";
import { defaultSelection, selectionExists } from "../model/inspector";
import { isRedAlert } from "../model/metrics";
import { getBundledFloor, refreshedSeed } from "../model/load";
import { tourStops, tourWalkIds, arcsForSelection, type TourStop } from "../model/tour";
import type { AgentPawn, FilterId, FloorModel, Selection } from "../model/types";
import { playCue, syncMute } from "./audio";

export type RangeId = "today" | "7d" | "30d";
export type NavId = "home" | "traces" | "graph" | "timeline" | "procedures" | "approvals" | "agents" | "settings";
export type LayerId = "mesh" | "traces" | "telemetry";
export type OpsMode = "public" | "live";

interface FloorStore {
  base: FloorModel;
  edits: FloorEdits;
  filter: FilterId;
  query: string;
  range: RangeId;
  selection: Selection;
  layers: Record<LayerId, boolean>;
  hiddenRacks: string[];
  acknowledged: string[];
  rolling: boolean;
  tourActive: boolean;
  tourIndex: number;
  note: string;
  banner: string | null;
  framed: boolean;
  editMode: boolean;
  muted: boolean;
  nav: NavId;
  drawerOpen: boolean;
  helpOpen: boolean;
  opsMode: OpsMode;
  flyToken: number;
  resetToken: number;
  burstArcIds: string[];
  walkSerial: Record<string, number>;
  setBanner: (banner: string | null) => void;
  setNote: (note: string) => void;
  setFramed: (framed: boolean) => void;
  setFilter: (filter: FilterId) => void;
  setQuery: (query: string) => void;
  setRange: (range: RangeId) => void;
  setNav: (nav: NavId) => void;
  setDrawer: (open: boolean) => void;
  setHelp: (open: boolean) => void;
  setEditMode: (on: boolean) => void;
  setMuted: (muted: boolean) => void;
  setOpsMode: (mode: OpsMode) => void;
  toggleLayer: (layer: LayerId) => void;
  toggleRack: (id: string) => void;
  select: (selection: Selection) => void;
  resetSelection: () => void;
  resetView: () => void;
  applyLoaded: (floor: FloorModel, note: string) => void;
  startTour: () => void;
  advanceTour: () => void;
  reviewAll: () => void;
  setPadColor: (id: string, color: string) => void;
  addPad: (name: string, color: string) => boolean;
  addAgent: (name: string, padId: string) => boolean;
  addArc: (padId: string, rackId: string) => boolean;
}

let cachedBase: FloorModel | null = null;
let cachedEdits: FloorEdits | null = null;
let cachedFloor: FloorModel | null = null;

function displayed(base: FloorModel, edits: FloorEdits): FloorModel {
  if (base === cachedBase && edits === cachedEdits && cachedFloor) return cachedFloor;
  cachedBase = base;
  cachedEdits = edits;
  cachedFloor = applyEdits(base, edits);
  return cachedFloor;
}

function bumpMany(serial: Record<string, number>, ids: string[]): Record<string, number> {
  const next = { ...serial };
  for (const id of ids) next[id] = (next[id] ?? 0) + 1;
  return next;
}

function bumpChanged(prev: FloorModel, next: FloorModel, serial: Record<string, number>): Record<string, number> {
  const out = { ...serial };
  let changed = false;
  for (const agent of next.agents) {
    const before = prev.agents.find((item) => item.id === agent.id);
    if (!before) continue;
    if (before.state !== agent.state || before.status !== agent.status) {
      out[agent.id] = (out[agent.id] ?? 0) + 1;
      changed = true;
    }
  }
  return changed ? out : serial;
}

function withAck(acknowledged: string[], floor: FloorModel, selection: Selection): string[] {
  if (!isRedAlert(selection.kind, selection.id, floor) || acknowledged.includes(selection.id)) return acknowledged;
  return [...acknowledged, selection.id];
}

function focusStop(stop: TourStop, floor: FloorModel, serial: Record<string, number>, flyToken: number) {
  return {
    selection: stop.selection,
    flyToken: flyToken + 1,
    burstArcIds: stop.arcIds,
    walkSerial: bumpMany(serial, tourWalkIds(floor, stop)),
  };
}

const seed = getBundledFloor();
syncMute(true);

export const useFloor = create<FloorStore>((set, get) => ({
  base: seed,
  edits: loadEdits(seed),
  filter: "all",
  query: "",
  range: "today",
  selection: defaultSelection(seed),
  layers: { mesh: true, traces: true, telemetry: true },
  hiddenRacks: [],
  acknowledged: [],
  rolling: false,
  tourActive: false,
  tourIndex: 0,
  note: "Static seed · checks not run",
  banner: null,
  framed: false,
  editMode: false,
  muted: true,
  nav: "home",
  drawerOpen: false,
  helpOpen: false,
  opsMode: "public",
  flyToken: 0,
  resetToken: 0,
  burstArcIds: [],
  walkSerial: {},
  setBanner: (banner) => set({ banner }),
  setNote: (note) => set({ note }),
  setFramed: (framed) => set({ framed }),
  setFilter: (filter) => set({ filter }),
  setQuery: (query) => set({ query }),
  setRange: (range) => set({ range }),
  setNav: (nav) => set({ nav, drawerOpen: false }),
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  setHelp: (helpOpen) => set({ helpOpen }),
  setEditMode: (editMode) => set({ editMode }),
  setMuted: (muted) => {
    syncMute(muted);
    set({ muted });
  },
  setOpsMode: (opsMode) => {
    if (opsMode === get().opsMode) return;
    if (opsMode === "public") {
      const next = getBundledFloor();
      const selection = selectionExists(next, get().selection) ? get().selection : defaultSelection(next);
      set({ opsMode, base: next, note: "Public seed", selection, tourActive: false, rolling: false, burstArcIds: [] });
      return;
    }
    set({ opsMode, note: "Live Ops" });
  },
  toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
  toggleRack: (id) => {
    const hidden = get().hiddenRacks;
    set({ hiddenRacks: hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id] });
  },
  select: (selection) => {
    const floor = displayed(get().base, get().edits);
    const red = isRedAlert(selection.kind, selection.id, floor);
    set({
      selection,
      nav: "home",
      flyToken: get().flyToken + 1,
      burstArcIds: arcsForSelection(floor, selection),
      acknowledged: withAck(get().acknowledged, floor, selection),
    });
    playCue(red ? "alert" : "select");
    if (arcsForSelection(floor, selection).length > 0) playCue("packet");
  },
  resetSelection: () => {
    const floor = displayed(get().base, get().edits);
    get().select(defaultSelection(floor));
  },
  resetView: () => set({ resetToken: get().resetToken + 1 }),
  applyLoaded: (floor, note) => {
    const prev = get().base;
    const selection = selectionExists(floor, get().selection) ? get().selection : defaultSelection(floor);
    set({
      base: floor,
      note,
      selection,
      walkSerial: bumpChanged(prev, floor, get().walkSerial),
      tourActive: false,
      rolling: false,
      tourIndex: 0,
      burstArcIds: [],
    });
  },
  startTour: () => {
    if (get().rolling) return;
    const next = refreshedSeed();
    const floor = displayed(next, get().edits);
    const stops = tourStops(floor);
    const first = stops[0];
    if (!first) {
      set({ base: next, note: "Seed refreshed · nothing to tour", rolling: false, tourActive: false, burstArcIds: [] });
      return;
    }
    set({
      base: next,
      note: `Seed refreshed · touring ${stops.length} stops`,
      rolling: true,
      tourActive: true,
      tourIndex: 0,
      nav: "home",
      ...focusStop(first, floor, get().walkSerial, get().flyToken),
    });
    playCue("step");
    if (isRedAlert(first.selection.kind, first.selection.id, floor)) playCue("alert");
    if (first.arcIds.length > 0) playCue("packet");
  },
  advanceTour: () => {
    if (!get().tourActive) return;
    const floor = displayed(get().base, get().edits);
    const stops = tourStops(floor);
    const nextIndex = get().tourIndex + 1;
    if (nextIndex >= stops.length) {
      set({ tourActive: false, rolling: false, burstArcIds: [], note: "Seed refreshed · tour complete" });
      return;
    }
    const stop = stops[nextIndex];
    set({
      tourIndex: nextIndex,
      note: `Seed refreshed · touring ${stops.length} stops`,
      ...focusStop(stop, floor, get().walkSerial, get().flyToken),
    });
    playCue("step");
    if (stop.arcIds.length > 0) playCue("packet");
  },
  reviewAll: () => {
    const floor = displayed(get().base, get().edits);
    const waiting = floor.agents.find((agent) => agent.state === "waiting_samuel");
    if (waiting) {
      set({ filter: "waiting" });
      get().select({ kind: "pawn", id: waiting.id });
      return;
    }
    const red = tourStops(floor)[0];
    if (red) {
      set({ filter: "red" });
      get().select(red.selection);
      return;
    }
    set({ filter: "all" });
  },
  setPadColor: (id, color) => {
    const floor = displayed(get().base, get().edits);
    const next = recolorPad(id, color, floor);
    if (!next) return;
    set({ edits: { ...get().edits, padColors: { ...get().edits.padColors, [id]: next } } });
  },
  addPad: (name, color) => {
    const floor = displayed(get().base, get().edits);
    const pad = createPad(name, color, floor);
    if (!pad) return false;
    set({
      edits: { ...get().edits, pads: [...get().edits.pads, pad] },
      selection: { kind: "pad", id: pad.id },
      flyToken: get().flyToken + 1,
      nav: "home",
    });
    return true;
  },
  addAgent: (name, padId) => {
    const floor = displayed(get().base, get().edits);
    const agent: AgentPawn | null = createAgent(name, padId, floor);
    if (!agent) return false;
    set({
      edits: { ...get().edits, agents: [...get().edits.agents, agent] },
      selection: { kind: "pawn", id: agent.id },
      nav: "home",
    });
    return true;
  },
  addArc: (padId, rackId) => {
    const floor = displayed(get().base, get().edits);
    const arc = createArc(padId, rackId, floor);
    if (!arc) return false;
    set({ edits: { ...get().edits, arcs: [...get().edits.arcs, arc] } });
    return true;
  },
}));

useFloor.subscribe((state, prev) => {
  if (state.edits !== prev.edits) saveEdits(state.edits);
});

export function useDisplayedFloor(): FloorModel {
  return useFloor((state) => displayed(state.base, state.edits));
}
