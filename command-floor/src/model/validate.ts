import { computeCounts } from "./counts";
import { sensitiveKind } from "./publicText";
import type {
  AgentPawn,
  CheckStatus,
  Checks,
  CommandFloorData,
  DatabaseRack,
  FloorModel,
  Level,
  PawnState,
  ProjectPad,
  Vec2,
  Vec3,
} from "./types";

const LEVELS = new Set<Level>(["HEALTHY", "WARNING", "CRITICAL", "IDLE"]);
const STATES = new Set<PawnState>(["active", "waiting_samuel", "red_alert", "idle"]);
const CHECKS = new Set<CheckStatus>(["not_run", "ok", "down", "unknown"]);
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_PADS = 32;
const MAX_RACKS = 16;
const MAX_AGENTS = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(obj: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) throw new Error(`${path}: unknown field ${key}`);
  }
  for (const key of required) {
    if (!(key in obj)) throw new Error(`${path}: missing ${key}`);
  }
}

function hasControl(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function reqString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 120) {
    throw new Error(`${path}: expected short text`);
  }
  if (hasControl(value)) throw new Error(`${path}: control character`);
  const kind = sensitiveKind(value);
  if (kind) throw new Error(`${path}: sensitive ${kind}`);
  return value;
}

function nullString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return reqString(value, path);
}

function reqNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -500 || value > 500) {
    throw new Error(`${path}: expected number`);
  }
  return value;
}

function reqVec3(value: unknown, path: string): Vec3 {
  if (!isRecord(value)) throw new Error(`${path}: expected position`);
  assertKeys(value, ["x", "y", "z"], [], path);
  return { x: reqNumber(value.x, `${path}.x`), y: reqNumber(value.y, `${path}.y`), z: reqNumber(value.z, `${path}.z`) };
}

function reqVec2(value: unknown, path: string): Vec2 {
  if (!isRecord(value)) throw new Error(`${path}: expected offset`);
  assertKeys(value, ["x", "z"], [], path);
  return { x: reqNumber(value.x, `${path}.x`), z: reqNumber(value.z, `${path}.z`) };
}

function reqSlug(value: unknown, path: string): string {
  const id = reqString(value, path);
  if (!SLUG.test(id)) throw new Error(`${path}: expected a lowercase slug`);
  return id;
}

function reqLevel(value: unknown, path: string): Level {
  if (typeof value !== "string" || !LEVELS.has(value as Level)) throw new Error(`${path}: bad level`);
  return value as Level;
}

function reqState(value: unknown, path: string): PawnState {
  if (typeof value !== "string" || !STATES.has(value as PawnState)) throw new Error(`${path}: bad state`);
  return value as PawnState;
}

function reqCheck(value: unknown, path: string): CheckStatus {
  if (typeof value !== "string" || !CHECKS.has(value as CheckStatus)) throw new Error(`${path}: bad check`);
  return value as CheckStatus;
}

function parsePad(value: unknown, index: number): ProjectPad {
  const path = `project_pads[${index}]`;
  if (!isRecord(value)) throw new Error(`${path}: expected object`);
  assertKeys(
    value,
    ["id", "erp_id", "name", "stage", "level", "pad_color", "position", "repos_label", "hosting_label", "status_label", "action_item", "connected_db_ids", "open_pr_count"],
    [],
    path,
  );
  if (!Array.isArray(value.connected_db_ids) || value.connected_db_ids.length > 8) {
    throw new Error(`${path}.connected_db_ids: expected a short list`);
  }
  let openPr: number | null = null;
  if (value.open_pr_count !== null) {
    if (typeof value.open_pr_count !== "number" || !Number.isInteger(value.open_pr_count) || value.open_pr_count < 0 || value.open_pr_count > 999) {
      throw new Error(`${path}.open_pr_count: expected an integer or null`);
    }
    openPr = value.open_pr_count;
  }
  const color = reqString(value.pad_color, `${path}.pad_color`);
  if (!COLOR.test(color)) throw new Error(`${path}.pad_color: expected #rrggbb`);
  return {
    id: reqSlug(value.id, `${path}.id`),
    erp_id: reqString(value.erp_id, `${path}.erp_id`),
    name: reqString(value.name, `${path}.name`),
    stage: reqString(value.stage, `${path}.stage`),
    level: reqLevel(value.level, `${path}.level`),
    pad_color: color,
    position: reqVec3(value.position, `${path}.position`),
    repos_label: reqString(value.repos_label, `${path}.repos_label`),
    hosting_label: reqString(value.hosting_label, `${path}.hosting_label`),
    status_label: reqString(value.status_label, `${path}.status_label`),
    action_item: nullString(value.action_item, `${path}.action_item`),
    connected_db_ids: value.connected_db_ids.map((id, link) => reqSlug(id, `${path}.connected_db_ids[${link}]`)),
    open_pr_count: openPr,
  };
}

function parseRack(value: unknown, index: number): DatabaseRack {
  const path = `database_racks[${index}]`;
  if (!isRecord(value)) throw new Error(`${path}: expected object`);
  assertKeys(value, ["id", "name", "engine", "host", "status_label", "level", "position", "action_item"], [], path);
  return {
    id: reqSlug(value.id, `${path}.id`),
    name: reqString(value.name, `${path}.name`),
    engine: reqString(value.engine, `${path}.engine`),
    host: reqString(value.host, `${path}.host`),
    status_label: reqString(value.status_label, `${path}.status_label`),
    level: reqLevel(value.level, `${path}.level`),
    position: reqVec3(value.position, `${path}.position`),
    action_item: nullString(value.action_item, `${path}.action_item`),
  };
}

function parseAgent(value: unknown, index: number): AgentPawn {
  const path = `agents[${index}]`;
  if (!isRecord(value)) throw new Error(`${path}: expected object`);
  assertKeys(value, ["id", "name", "bot_type", "role", "assigned_pad_id", "state", "status", "waiting_on_samuel", "offset"], [], path);
  return {
    id: reqSlug(value.id, `${path}.id`),
    name: reqString(value.name, `${path}.name`),
    bot_type: reqString(value.bot_type, `${path}.bot_type`),
    role: reqString(value.role, `${path}.role`),
    assigned_pad_id: value.assigned_pad_id === null ? null : reqSlug(value.assigned_pad_id, `${path}.assigned_pad_id`),
    state: reqState(value.state, `${path}.state`),
    status: reqString(value.status, `${path}.status`),
    waiting_on_samuel: nullString(value.waiting_on_samuel, `${path}.waiting_on_samuel`),
    offset: reqVec2(value.offset, `${path}.offset`),
  };
}

function parseChecks(value: unknown): Checks {
  if (!isRecord(value)) throw new Error("checks: expected object");
  assertKeys(value, ["postgres", "loom", "github", "checked_at"], [], "checks");
  let checkedAt: string | null = null;
  if (value.checked_at !== null) {
    checkedAt = reqString(value.checked_at, "checks.checked_at");
    if (!/^\d{4}-\d{2}-\d{2}T/.test(checkedAt)) throw new Error("checks.checked_at: expected an ISO time");
  }
  return {
    postgres: reqCheck(value.postgres, "checks.postgres"),
    loom: reqCheck(value.loom, "checks.loom"),
    github: reqCheck(value.github, "checks.github"),
    checked_at: checkedAt,
  };
}

export function parseCommandFloor(input: unknown): CommandFloorData {
  if (!isRecord(input)) throw new Error("command floor: expected object");
  assertKeys(input, ["title", "subtitle", "project_pads", "database_racks", "agents", "checks"], ["counts"], "command floor");
  if (!Array.isArray(input.project_pads) || input.project_pads.length < 1 || input.project_pads.length > MAX_PADS) {
    throw new Error("project_pads: expected a short list");
  }
  if (!Array.isArray(input.database_racks) || input.database_racks.length > MAX_RACKS) {
    throw new Error("database_racks: expected a short list");
  }
  if (!Array.isArray(input.agents) || input.agents.length > MAX_AGENTS) {
    throw new Error("agents: expected a short list");
  }
  const data: CommandFloorData = {
    title: reqString(input.title, "title"),
    subtitle: reqString(input.subtitle, "subtitle"),
    project_pads: input.project_pads.map(parsePad),
    database_racks: input.database_racks.map(parseRack),
    agents: input.agents.map(parseAgent),
    checks: parseChecks(input.checks),
  };
  const ids = new Set<string>();
  const claim = (id: string, path: string) => {
    if (ids.has(id)) throw new Error(`${path}: duplicate id ${id}`);
    ids.add(id);
  };
  const padIds = new Set<string>();
  const rackIds = new Set<string>();
  for (const pad of data.project_pads) {
    claim(pad.id, "project_pads");
    padIds.add(pad.id);
  }
  for (const rack of data.database_racks) {
    claim(rack.id, "database_racks");
    rackIds.add(rack.id);
  }
  for (const agent of data.agents) claim(agent.id, "agents");
  for (const pad of data.project_pads) {
    for (const rackId of pad.connected_db_ids) {
      if (!rackIds.has(rackId)) throw new Error(`project_pads.${pad.id}: unknown rack ${rackId}`);
    }
  }
  for (const agent of data.agents) {
    if (agent.assigned_pad_id && !padIds.has(agent.assigned_pad_id)) {
      throw new Error(`agents.${agent.id}: unknown pad ${agent.assigned_pad_id}`);
    }
  }
  return data;
}

export function floorFromUnknown(input: unknown): FloorModel {
  const data = parseCommandFloor(input);
  return { ...data, counts: computeCounts(data) };
}
