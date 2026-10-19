import { computeCounts } from "./counts";
import { parseCommandFloor } from "./validate";
import type { AgentPawn, CommandFloorData, FloorModel, ProjectPad, Vec2, Vec3 } from "./types";

export const STORAGE_KEY = "command-floor-edits-v1";
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export interface FloorArc {
  padId: string;
  rackId: string;
}

export interface FloorEdits {
  padColors: Record<string, string>;
  pads: ProjectPad[];
  agents: AgentPawn[];
  arcs: FloorArc[];
}

export function emptyEdits(): FloorEdits {
  return { padColors: {}, pads: [], agents: [], arcs: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneData(data: CommandFloorData): CommandFloorData {
  return JSON.parse(JSON.stringify(data)) as CommandFloorData;
}

function tryParse(data: CommandFloorData): CommandFloorData | null {
  try {
    return parseCommandFloor(JSON.parse(JSON.stringify(data)) as unknown);
  } catch {
    return null;
  }
}

function withoutCounts(floor: FloorModel): CommandFloorData {
  return {
    title: floor.title,
    subtitle: floor.subtitle,
    project_pads: floor.project_pads,
    database_racks: floor.database_racks,
    agents: floor.agents,
    checks: floor.checks,
  };
}

export function isEmptyEdits(edits: FloorEdits): boolean {
  return Object.keys(edits.padColors).length === 0 && edits.pads.length === 0 && edits.agents.length === 0 && edits.arcs.length === 0;
}

export function applyEdits(base: FloorModel, edits: FloorEdits): FloorModel {
  if (isEmptyEdits(edits)) return base;
  const pads = base.project_pads.map((pad) => ({ ...pad, connected_db_ids: [...pad.connected_db_ids] }));
  for (const extra of edits.pads) pads.push({ ...extra, connected_db_ids: [...extra.connected_db_ids] });
  for (const pad of pads) {
    const color = edits.padColors[pad.id];
    if (color) pad.pad_color = color;
  }
  for (const arc of edits.arcs) {
    const pad = pads.find((item) => item.id === arc.padId);
    if (!pad || pad.connected_db_ids.includes(arc.rackId)) continue;
    pad.connected_db_ids.push(arc.rackId);
  }
  const merged: CommandFloorData = {
    title: base.title,
    subtitle: base.subtitle,
    project_pads: pads,
    database_racks: base.database_racks.map((rack) => ({ ...rack })),
    agents: [...base.agents.map((agent) => ({ ...agent })), ...edits.agents.map((agent) => ({ ...agent }))],
    checks: { ...base.checks },
  };
  const parsed = tryParse(merged);
  if (!parsed) return base;
  return { ...parsed, counts: computeCounts(parsed) };
}

export function sanitizeEdits(raw: string | null, base: CommandFloorData): FloorEdits {
  const edits = emptyEdits();
  if (!raw) return edits;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return edits;
  }
  if (!isRecord(parsed)) return edits;
  let current = cloneData(base);

  if (isRecord(parsed.padColors)) {
    for (const [id, color] of Object.entries(parsed.padColors)) {
      if (typeof color !== "string") continue;
      const next = cloneData(current);
      const pad = next.project_pads.find((item) => item.id === id);
      if (!pad) continue;
      pad.pad_color = color;
      const accepted = tryParse(next);
      if (!accepted) continue;
      edits.padColors[id] = accepted.project_pads.find((item) => item.id === id)?.pad_color ?? color;
      current = accepted;
    }
  }

  if (Array.isArray(parsed.pads)) {
    for (const candidate of parsed.pads) {
      const next = cloneData(current);
      next.project_pads.push(candidate as ProjectPad);
      const accepted = tryParse(next);
      if (!accepted) continue;
      const known = new Set(current.project_pads.map((pad) => pad.id));
      const added = accepted.project_pads.filter((pad) => !known.has(pad.id));
      if (added.length !== 1) continue;
      edits.pads.push(added[0]);
      current = accepted;
    }
  }

  if (Array.isArray(parsed.agents)) {
    for (const candidate of parsed.agents) {
      const next = cloneData(current);
      next.agents.push(candidate as AgentPawn);
      const accepted = tryParse(next);
      if (!accepted) continue;
      const known = new Set(current.agents.map((agent) => agent.id));
      const added = accepted.agents.filter((agent) => !known.has(agent.id));
      if (added.length !== 1) continue;
      edits.agents.push(added[0]);
      current = accepted;
    }
  }

  if (Array.isArray(parsed.arcs)) {
    for (const candidate of parsed.arcs) {
      if (!isRecord(candidate) || typeof candidate.padId !== "string" || typeof candidate.rackId !== "string") continue;
      const next = cloneData(current);
      const pad = next.project_pads.find((item) => item.id === candidate.padId);
      if (!pad || pad.connected_db_ids.includes(candidate.rackId)) continue;
      pad.connected_db_ids = [...pad.connected_db_ids, candidate.rackId];
      const accepted = tryParse(next);
      if (!accepted) continue;
      edits.arcs.push({ padId: candidate.padId, rackId: candidate.rackId });
      current = accepted;
    }
  }

  return edits;
}

export function loadEdits(base: CommandFloorData): FloorEdits {
  if (typeof localStorage === "undefined") return emptyEdits();
  try {
    return sanitizeEdits(localStorage.getItem(STORAGE_KEY), base);
  } catch {
    return emptyEdits();
  }
}

export function saveEdits(edits: FloorEdits): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch {
    // The floor still shows the in-memory edit when storage is full.
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function slugify(name: string, taken: Set<string>): string | null {
  let base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!base) return null;
  if (!/^[a-z]/.test(base)) base = `desk-${base}`;
  if (!SLUG.test(base)) return null;
  let id = base;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 24 || !SLUG.test(id)) return null;
  }
  return id;
}

function takenIds(floor: FloorModel): Set<string> {
  return new Set([
    ...floor.project_pads.map((pad) => pad.id),
    ...floor.database_racks.map((rack) => rack.id),
    ...floor.agents.map((agent) => agent.id),
  ]);
}

export function nextPadPosition(count: number): Vec3 {
  const angle = (count / 12) * Math.PI * 2;
  const radius = 16 + (count % 3);
  return { x: round2(Math.cos(angle) * radius), y: 0, z: round2(Math.sin(angle) * radius) };
}

export function nextOffset(agents: AgentPawn[], padId: string): Vec2 {
  const count = agents.filter((agent) => agent.assigned_pad_id === padId).length;
  const angle = (count / 8) * Math.PI * 2;
  return { x: round2(Math.cos(angle) * 2.2), z: round2(Math.sin(angle) * 2.2) };
}

export function createPad(name: string, color: string, floor: FloorModel): ProjectPad | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120 || !COLOR.test(color)) return null;
  const id = slugify(trimmed, takenIds(floor));
  if (!id) return null;
  const pad: ProjectPad = {
    id,
    erp_id: `L${floor.project_pads.length + 1}`,
    name: trimmed,
    stage: "Planning",
    level: "IDLE",
    pad_color: color,
    position: nextPadPosition(floor.project_pads.length),
    repos_label: "Local edit",
    hosting_label: "This browser",
    status_label: "Added on this device",
    action_item: null,
    connected_db_ids: [],
    open_pr_count: 0,
    repos: [],
  };
  const next = applyEdits(floor, { ...emptyEdits(), pads: [pad] });
  return next.project_pads.some((item) => item.id === pad.id) ? pad : null;
}

export function createAgent(name: string, padId: string, floor: FloorModel): AgentPawn | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) return null;
  if (!floor.project_pads.some((pad) => pad.id === padId)) return null;
  const id = slugify(trimmed, takenIds(floor));
  if (!id) return null;
  const agent: AgentPawn = {
    id,
    name: trimmed,
    bot_type: "Local edit",
    role: "Added on this device",
    assigned_pad_id: padId,
    state: "idle",
    status: "Idle",
    waiting_on_samuel: null,
    offset: nextOffset(floor.agents, padId),
  };
  const next = applyEdits(floor, { ...emptyEdits(), agents: [agent] });
  return next.agents.some((item) => item.id === agent.id) ? agent : null;
}

export function createArc(padId: string, rackId: string, floor: FloorModel): FloorArc | null {
  const pad = floor.project_pads.find((item) => item.id === padId);
  if (!pad || pad.connected_db_ids.includes(rackId)) return null;
  if (!floor.database_racks.some((rack) => rack.id === rackId)) return null;
  const arc = { padId, rackId };
  const next = applyEdits(floor, { ...emptyEdits(), arcs: [arc] });
  const updated = next.project_pads.find((item) => item.id === padId);
  return updated?.connected_db_ids.includes(rackId) ? arc : null;
}

export function recolorPad(id: string, color: string, floor: FloorModel): string | null {
  if (!COLOR.test(color)) return null;
  const next = applyEdits(floor, { ...emptyEdits(), padColors: { [id]: color } });
  const pad = next.project_pads.find((item) => item.id === id);
  if (!pad || pad.pad_color.toLowerCase() !== color.toLowerCase()) return null;
  return pad.pad_color;
}

export function toExportDocument(floor: FloorModel): CommandFloorData {
  return withoutCounts(floor);
}
