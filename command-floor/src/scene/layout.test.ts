import { describe, expect, it } from "vitest";
import { getBundledFloor } from "../model/load";
import type { LayoutInput } from "./layout";
import { frameScene } from "./layout";

function points(pads: { x: number; z: number }[], racks: { x: number; z: number }[] = []): LayoutInput {
  return {
    project_pads: pads.map((pad, index) => ({ id: `p${index}`, position: { x: pad.x, y: 0, z: pad.z } })),
    database_racks: racks.map((rack) => ({ position: { x: rack.x, y: 0, z: rack.z } })),
    agents: [],
  };
}

describe("command floor layout", () => {
  const floor = getBundledFloor();

  it("sizes pads from the seed spacing so pawn offsets stay on the pad", () => {
    const layout = frameScene(floor);
    let maxOffset = 0;
    for (const agent of floor.agents) {
      maxOffset = Math.max(maxOffset, Math.hypot(agent.offset.x, agent.offset.z));
    }
    expect(maxOffset).toBeGreaterThan(0);
    expect(layout.padWidth / 2).toBeGreaterThan(maxOffset);
    expect(layout.center[2]).toBeLessThan(-4);
    expect(layout.cameraPosition[2]).toBeGreaterThan(layout.center[2]);
    expect(layout.vault).not.toBeNull();
  });

  it("frames whatever positions it is given", () => {
    const wide = frameScene(points([{ x: 0, z: 0 }, { x: 100, z: 0 }], [{ x: 40, z: -30 }]));
    const tight = frameScene(points([{ x: 0, z: 0 }, { x: 4, z: 0 }]));
    const single = frameScene(points([{ x: 12, z: -6 }]));
    expect(wide.padWidth).toBeGreaterThan(tight.padWidth);
    expect(wide.center[0]).toBeGreaterThan(40);
    expect(tight.center[0]).toBeCloseTo(2, 0);
    expect(single.center[0]).toBeCloseTo(12, 0);
    expect(single.center[2]).toBeCloseTo(-6, 0);
    expect(single.vault).toBeNull();
    expect(tight.vault).toBeNull();
    expect(wide.vault).not.toBeNull();
  });
});
