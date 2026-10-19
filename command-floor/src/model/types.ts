export type Level = "HEALTHY" | "WARNING" | "CRITICAL" | "IDLE";
export type PawnState = "active" | "waiting_samuel" | "red_alert" | "idle";
export type CheckStatus = "not_run" | "ok" | "down" | "unknown";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface ProjectPad {
  id: string;
  erp_id: string;
  name: string;
  stage: string;
  level: Level;
  pad_color: string;
  position: Vec3;
  repos_label: string;
  hosting_label: string;
  status_label: string;
  action_item: string | null;
  connected_db_ids: string[];
  open_pr_count: number | null;
}

export interface DatabaseRack {
  id: string;
  name: string;
  engine: string;
  host: string;
  status_label: string;
  level: Level;
  position: Vec3;
  action_item: string | null;
}

export interface AgentPawn {
  id: string;
  name: string;
  bot_type: string;
  role: string;
  assigned_pad_id: string | null;
  state: PawnState;
  status: string;
  waiting_on_samuel: string | null;
  offset: Vec2;
}

export interface Checks {
  postgres: CheckStatus;
  loom: CheckStatus;
  github: CheckStatus;
  checked_at: string | null;
}

export interface CommandFloorData {
  title: string;
  subtitle: string;
  project_pads: ProjectPad[];
  database_racks: DatabaseRack[];
  agents: AgentPawn[];
  checks: Checks;
}

export interface Counts {
  red_alerts: number;
  waiting_samuel: number;
  open_prs: number;
  total: number;
}

export interface FloorModel extends CommandFloorData {
  counts: Counts;
}

export type FilterId = "all" | "red" | "waiting" | "prs";
export type ObjectKind = "pad" | "rack" | "pawn" | "arc";

export type Selection =
  | { kind: "pad"; id: string }
  | { kind: "rack"; id: string }
  | { kind: "pawn"; id: string };

export type InspectorTone = "red" | "warn" | "green" | "grey" | "blue";

export interface InspectorModel {
  title: string;
  erp: string;
  stage: string;
  level: string;
  tone: InspectorTone;
  repos: string;
  hosting: string;
  status: string;
  action: string | null;
}
