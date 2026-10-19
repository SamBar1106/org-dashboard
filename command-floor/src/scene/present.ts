import type { LayoutInput } from "./layout";
import type { Vec2, Vec3 } from "../model/types";

export interface PresentInput {
  project_pads: { id: string; position: Vec3 }[];
  database_racks: { id: string; position: Vec3 }[];
  agents: { id: string; assigned_pad_id: string | null; offset: Vec2 }[];
}

export interface Presented {
  pads: Map<string, Vec3>;
  racks: Map<string, Vec3>;
  agents: Map<string, Vec3>;
  vault: Vec3;
  layoutInput: LayoutInput;
}

/**
 * View transform only. Seed positions stay in the orchestrator file.
 * Pads sit on an arc facing the camera, racks sit on the central vault.
 */
export function presentScene(input: PresentInput): Presented {
  const padCount = input.project_pads.length;
  const arc = Math.PI * 1.15;
  const radius = Math.max(18, padCount * 2.4);
  const pads = new Map<string, Vec3>();
  input.project_pads.forEach((pad, index) => {
    const t = padCount <= 1 ? 0.5 : index / (padCount - 1);
    const theta = Math.PI / 2 - arc / 2 + arc * t;
    pads.set(pad.id, {
      x: Math.cos(theta) * radius,
      y: pad.position.y,
      z: Math.sin(theta) * radius,
    });
  });

  const rackCount = input.database_racks.length;
  const rackRadius = rackCount === 0 ? 0 : Math.max(9, rackCount * 1.6);
  const racks = new Map<string, Vec3>();
  input.database_racks.forEach((rack, index) => {
    const theta = (index / Math.max(rackCount, 1)) * Math.PI * 2 - Math.PI / 2;
    racks.set(rack.id, {
      x: Math.cos(theta) * rackRadius,
      y: rack.position.y,
      z: Math.sin(theta) * rackRadius,
    });
  });

  let maxOffset = 0;
  for (const agent of input.agents) maxOffset = Math.max(maxOffset, Math.hypot(agent.offset.x, agent.offset.z));
  const offsetScale = maxOffset > 1.15 ? 1.15 / maxOffset : 1;
  const agents = new Map<string, Vec3>();
  for (const agent of input.agents) {
    const pad = agent.assigned_pad_id ? pads.get(agent.assigned_pad_id) : undefined;
    agents.set(agent.id, {
      x: (pad?.x ?? 0) + agent.offset.x * offsetScale,
      y: pad?.y ?? 0,
      z: (pad?.z ?? 0) + agent.offset.z * offsetScale,
    });
  }

  let vaultX = 0;
  let vaultZ = 0;
  if (racks.size > 0) {
    for (const rack of racks.values()) {
      vaultX += rack.x;
      vaultZ += rack.z;
    }
    vaultX /= racks.size;
    vaultZ /= racks.size;
  }

  const layoutInput: LayoutInput = {
    project_pads: input.project_pads.map((pad) => ({ id: pad.id, position: pads.get(pad.id) ?? pad.position })),
    database_racks: input.database_racks.map((rack) => ({ position: racks.get(rack.id) ?? rack.position })),
    agents: input.agents.map((agent) => {
      const at = agents.get(agent.id);
      const pad = agent.assigned_pad_id ? pads.get(agent.assigned_pad_id) : undefined;
      return {
        assigned_pad_id: agent.assigned_pad_id,
        offset: { x: (at?.x ?? 0) - (pad?.x ?? 0), z: (at?.z ?? 0) - (pad?.z ?? 0) },
      };
    }),
  };

  return { pads, racks, agents, vault: { x: vaultX, y: 0, z: vaultZ }, layoutInput };
}
