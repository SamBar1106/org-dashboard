import type { Vec2, Vec3 } from "../model/types";
import { BASE_PAD_WIDTH } from "./geometries";

/** Anything the floor can draw. Positions stay in data space; only mesh size and the camera change. */
export interface LayoutInput {
  project_pads: { id: string; position: Vec3 }[];
  database_racks: { position: Vec3 }[];
  agents: { assigned_pad_id: string | null; offset: Vec2 }[];
}

export interface SceneLayout {
  padWidth: number;
  meshScale: number;
  center: [number, number, number];
  cameraPosition: [number, number, number];
  fov: number;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
  grid: { size: number; cell: number; section: number; fade: number };
  labelDistance: number;
  dashSize: number;
  gapSize: number;
  vault: { x: number; z: number; width: number; depth: number; thickness: number } | null;
}

const FOV = 34;

export function frameScene(input: LayoutInput): SceneLayout {
  const spacing = nearestSpacing(input.project_pads.map((pad) => pad.position));
  let maxOffset = 0;
  for (const agent of input.agents) {
    maxOffset = Math.max(maxOffset, Math.hypot(agent.offset.x, agent.offset.z));
  }
  const padWidth = Math.max(spacing * 0.44, maxOffset * 2.7, 1.4);
  const meshScale = padWidth / BASE_PAD_WIDTH;
  const padHalf = padWidth / 2;
  const rackHalf = (0.78 * meshScale) / 2;
  const pawnHalf = 0.2 * meshScale;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const include = (x: number, z: number, half: number) => {
    minX = Math.min(minX, x - half);
    maxX = Math.max(maxX, x + half);
    minZ = Math.min(minZ, z - half);
    maxZ = Math.max(maxZ, z + half);
  };
  for (const pad of input.project_pads) include(pad.position.x, pad.position.z, padHalf);
  for (const rack of input.database_racks) include(rack.position.x, rack.position.z, rackHalf);
  const padsById = new Map(input.project_pads.map((pad) => [pad.id, pad]));
  for (const agent of input.agents) {
    const pad = agent.assigned_pad_id ? padsById.get(agent.assigned_pad_id) : undefined;
    include((pad?.position.x ?? 0) + agent.offset.x, (pad?.position.z ?? 0) + agent.offset.z, pawnHalf);
  }
  if (!Number.isFinite(minX)) {
    minX = -2;
    maxX = 2;
    minZ = -2;
    maxZ = 2;
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, padWidth * 2);
  const halfFov = (FOV * Math.PI) / 360;
  const distance = (span / 2) / Math.tan(halfFov) * 0.9;
  const elevation = 0.62;
  const yaw = 0.12;
  const horizontal = distance * Math.cos(elevation);
  const cameraPosition: [number, number, number] = [
    centerX + Math.sin(yaw) * horizontal,
    distance * Math.sin(elevation),
    centerZ + Math.cos(yaw) * horizontal,
  ];
  const cell = Math.max(0.25, padWidth / 5);
  const dashSize = Math.max(0.12, meshScale * 0.1);

  return {
    padWidth,
    meshScale,
    center: [centerX, meshScale * 0.2, centerZ],
    cameraPosition,
    fov: FOV,
    near: 0.1,
    far: distance * 4,
    minDistance: Math.max(padWidth * 0.8, distance * 0.22),
    maxDistance: distance * 3.4,
    grid: {
      size: Math.max(12, Math.ceil(span * 1.7)),
      cell,
      section: Math.max(cell * 4, padWidth),
      fade: span * 0.95,
    },
    labelDistance: 2 * Math.tan(halfFov) * distance,
    dashSize,
    gapSize: dashSize * 0.7,
    vault: vaultOf(input.database_racks, padWidth, meshScale),
  };
}

function vaultOf(
  racks: { position: Vec3 }[],
  padWidth: number,
  meshScale: number,
): SceneLayout["vault"] {
  if (racks.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const rack of racks) {
    minX = Math.min(minX, rack.position.x);
    maxX = Math.max(maxX, rack.position.x);
    minZ = Math.min(minZ, rack.position.z);
    maxZ = Math.max(maxZ, rack.position.z);
  }
  const margin = padWidth * 0.55;
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    width: Math.max(padWidth * 1.4, maxX - minX + margin),
    depth: Math.max(padWidth * 0.9, maxZ - minZ + margin),
    thickness: 0.16 * meshScale,
  };
}

function nearestSpacing(points: Vec3[]): number {
  if (points.length < 2) return 4;
  const gaps: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    let best = Infinity;
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const gap = Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z);
      if (gap > 1e-3) best = Math.min(best, gap);
    }
    if (Number.isFinite(best)) gaps.push(best);
  }
  if (gaps.length === 0) return 4;
  return median(gaps);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}
