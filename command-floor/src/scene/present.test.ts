import { describe, expect, it } from "vitest";
import { getBundledFloor } from "../model/load";
import { frameScene } from "./layout";
import { presentScene } from "./present";

describe("command deck presentation", () => {
  it("places pads on an arc around the racks", () => {
    const floor = getBundledFloor();
    const presented = presentScene(floor);
    const padRadii = [...presented.pads.values()].map((point) => Math.hypot(point.x, point.z));
    const rackRadii = [...presented.racks.values()].map((point) => Math.hypot(point.x - presented.vault.x, point.z - presented.vault.z));
    expect(Math.max(...padRadii) - Math.min(...padRadii)).toBeLessThan(0.01);
    expect(Math.min(...padRadii)).toBeGreaterThan(Math.max(...rackRadii) + 8);
    const layout = frameScene(presented.layoutInput);
    let maxOffset = 0;
    for (const agent of presented.layoutInput.agents) maxOffset = Math.max(maxOffset, Math.hypot(agent.offset.x, agent.offset.z));
    expect(layout.padWidth / 2).toBeGreaterThan(maxOffset);
    expect(layout.vault).not.toBeNull();
  });
});
