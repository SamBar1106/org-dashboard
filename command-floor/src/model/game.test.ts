import { describe, expect, it } from "vitest";
import seedJson from "../../../data/command-floor.json";
import { isCompactNav } from "../hooks";
import { applyEdits, createAgent, createArc, createPad, emptyEdits, sanitizeEdits, toExportDocument } from "./edits";
import { objectOpacity } from "./match";
import { getBundledFloor } from "./load";
import { liveOpsReady } from "./liveOps";
import { deckChip, deckStats, formatSpend, formatTokens, laneSummary, taskCount } from "./metrics";
import { floorFromUnknown } from "./validate";
import { TOUR_STEP_MS, tourStops } from "./tour";

describe("live ops model", () => {
  const floor = getBundledFloor();

  it("derives the deck chip, lanes, and tour from the seed", () => {
    expect(deckStats(floor)).toEqual({ activePads: 8, dataHubs: 5 });
    expect(deckChip(floor)).toBe("COMMAND DECK • 8 Active Pads • 5 Data Hubs");
    expect(laneSummary(floor)).toBe("4 of 14 Lanes Active");
    expect(laneSummary({ ...floor, agents: floor.agents.map((agent) => ({ ...agent, state: "active" })) })).toBe("All 14 Lanes Active");
    const stops = tourStops(floor);
    expect(TOUR_STEP_MS).toBe(4000);
    expect(stops).toHaveLength(10);
    expect(stops[0]?.selection).toEqual({ kind: "pad", id: "mge-triage-hub" });
    expect(stops.some((stop) => stop.selection.id === "game-buddy")).toBe(true);
    expect(stops.filter((stop) => stop.selection.kind === "pawn")).toHaveLength(8);
  });

  it("formats spend only when the source provides it", () => {
    expect(formatSpend(null)).toBe("$—");
    expect(formatSpend(1.5)).toBe("$1.50");
    expect(formatTokens(undefined)).toBe("— tokens");
    expect(formatTokens(1200)).toBe("1,200 tokens");
    expect(taskCount({ kind: "pad", id: "sam-erp" }, floor)).toBe(2);
  });

  it("keeps edit-floor changes local and inside the orchestrator shape", () => {
    const pad = createPad("Relay Desk", "#112233", floor);
    expect(pad?.id).toBe("relay-desk");
    expect(createPad("ops@example.com", "#112233", floor)).toBeNull();
    const withPad = applyEdits(floor, { ...emptyEdits(), pads: pad ? [pad] : [] });
    expect(withPad.counts.total).toBe(floor.counts.total + 1);
    const agent = createAgent("Floor Runner", "relay-desk", withPad);
    expect(agent?.assigned_pad_id).toBe("relay-desk");
    const arc = createArc("gold-elite", "odoo", floor);
    expect(arc).toEqual({ padId: "gold-elite", rackId: "odoo" });
    const linked = applyEdits(floor, { ...emptyEdits(), arcs: arc ? [arc] : [] });
    expect(linked.project_pads.find((item) => item.id === "gold-elite")?.connected_db_ids).toContain("odoo");
    const exported = toExportDocument(withPad);
    expect(exported).not.toHaveProperty("counts");
    expect(floorFromUnknown(exported).project_pads.some((item) => item.id === "relay-desk")).toBe(true);
    const raw = JSON.stringify({
      padColors: { "sam-erp": "#abcdef", "missing-pad": "#ffffff" },
      pads: [{ id: "not a slug" }, pad],
      agents: [],
      arcs: [{ padId: "sam-erp", rackId: "not-a-rack" }, { padId: "loom", rackId: "odoo" }],
    });
    const edits = sanitizeEdits(raw, floor);
    expect(edits.padColors["sam-erp"]).toBe("#abcdef");
    expect(edits.padColors["missing-pad"]).toBeUndefined();
    expect(edits.pads.map((item) => item.id)).toEqual(["relay-desk"]);
    expect(edits.arcs).toEqual([{ padId: "loom", rackId: "odoo" }]);
  });

  it("hides one database's arcs without dimming the rack", () => {
    expect(objectOpacity("arc", "odoo::sam-erp", "all", floor, { hiddenRackIds: ["odoo"] })).toBe(0);
    expect(objectOpacity("rack", "odoo", "all", floor, { hiddenRackIds: ["odoo"] })).toBe(1);
    expect(objectOpacity("pad", "gold-elite", "all", floor, { query: "odoo" })).toBe(0.2);
    expect(objectOpacity("rack", "odoo", "all", floor, { query: "odoo" })).toBe(1);
  });

  it("enables live ops only for a public https API and login", () => {
    expect(liveOpsReady(undefined, undefined)).toBe(false);
    expect(liveOpsReady("https://api.example.com/api/command-floor", undefined)).toBe(false);
    expect(liveOpsReady("https://api.example.com/api/command-floor", "http://api.example.com/login")).toBe(false);
    expect(liveOpsReady("https://api.example.com/api/command-floor", "https://api.example.com/login")).toBe(true);
  });

  it("accepts optional usage fields and rejects a new required field", () => {
    const raw = structuredClone(seedJson) as { project_pads: Record<string, unknown>[] };
    raw.project_pads[0].spend_usd = 1.25;
    raw.project_pads[0].tokens = 400;
    const parsed = floorFromUnknown(raw);
    expect(parsed.project_pads[0]?.spend_usd).toBe(1.25);
    expect(parsed.project_pads[0]?.tokens).toBe(400);
    raw.project_pads[0].nickname = "desk";
    expect(() => floorFromUnknown(raw)).toThrow(/unknown field/);
  });

  it("collapses the sidebar on iPad sizes and keeps a short desktop window open", () => {
    expect(isCompactNav(1024, 1366)).toBe(true);
    expect(isCompactNav(1366, 1024)).toBe(true);
    expect(isCompactNav(1280, 800)).toBe(false);
    expect(isCompactNav(1440, 900)).toBe(false);
  });
});
