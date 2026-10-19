import { describe, expect, it } from "vitest";
import { DIMMED_OPACITY, objectOpacity, sceneObjects } from "./match";
import { getBundledFloor } from "./load";
import { defaultSelection, toInspector } from "./inspector";
import { sensitiveKind } from "./publicText";
import { rejectionMessage, resolveSource, simulateEndpoint } from "./source";
import { computeCounts } from "./counts";

describe("command floor seed", () => {
  const floor = getBundledFloor();

  it("uses the public title and computes every count", () => {
    expect(floor.title).toBe("Samuel's Virtual Command Floor");
    expect(floor.subtitle).toBe("Oct 19 Inventory & Tailscale Mesh Ecosystem");
    expect(floor.counts).toEqual(computeCounts(floor));
    expect(floor.project_pads).toHaveLength(7);
    expect(floor.database_racks).toHaveLength(4);
    expect(floor.counts).toEqual({ red_alerts: 4, waiting_samuel: 7, open_prs: 12, total: 28 });
  });

  it("names the four data-vault racks and defaults the inspector to Sam ERP App", () => {
    expect(floor.database_racks.map((rack) => rack.name).sort()).toEqual([
      "Loom Postgres 16",
      "MGE CSVs",
      "Odoo",
      "Sam ERP SQLite",
    ]);
    const selection = defaultSelection(floor);
    expect(selection).toEqual({ kind: "pad", id: "sam-erp" });
    const card = toInspector(selection, floor);
    expect(card.title).toBe("Sam ERP App");
    expect(card.erp).toBe("ERP #1");
    expect(card.stage).toBe("app / build");
    expect(card.level).toBe("WARNING");
    expect(card.action).toBeTruthy();
  });

  it("keeps the published seed free of secrets, client data, and addresses", () => {
    const texts = JSON.stringify(floor);
    expect(sensitiveKind(texts)).toBeNull();
    expect(texts).not.toMatch(/127\.0\.0\.1|localhost|@|ts\.net/i);
  });

  it("dims only the objects outside the active filter", () => {
    for (const item of sceneObjects(floor, "all")) expect(item.opacity).toBe(1);
    for (const filter of ["red", "waiting", "prs"] as const) {
      const opacities = sceneObjects(floor, filter).map((item) => item.opacity);
      expect(opacities).toContain(1);
      expect(opacities).toContain(DIMMED_OPACITY);
      expect(new Set(opacities)).toEqual(new Set([1, DIMMED_OPACITY]));
    }
    expect(objectOpacity("pad", "mge-triage", "red", floor)).toBe(1);
    expect(objectOpacity("pad", "content", "red", floor)).toBe(DIMMED_OPACITY);
    expect(objectOpacity("pad", "content", "prs", floor)).toBe(DIMMED_OPACITY);
    expect(objectOpacity("pawn", "outline-bot", "waiting", floor)).toBe(1);
    expect(objectOpacity("rack", "odoo", "waiting", floor)).toBe(DIMMED_OPACITY);
  });
});

describe("command floor source switch", () => {
  it("uses the seed unless given a public https URL", () => {
    expect(resolveSource(undefined)).toEqual({ kind: "seed" });
    expect(resolveSource("  ")).toEqual({ kind: "seed" });
    expect(resolveSource("http://127.0.0.1:8710/api/command-floor").kind).toBe("rejected");
    for (const [url, reason] of [
      ["https://127.0.0.1/api/command-floor", "loopback"],
      ["https://localhost/api/command-floor", "loopback"],
      ["http://api.example.com/api/command-floor", "not-https"],
      ["https://user:secret@api.example.com/api/command-floor", "invalid"],
    ] as const) {
      const source = resolveSource(url);
      expect(source.kind).toBe("rejected");
      if (source.kind === "rejected") expect(source.reason).toBe(reason);
    }
    expect(resolveSource("https://api.example.com/api/command-floor")).toEqual({
      kind: "remote",
      url: "https://api.example.com/api/command-floor",
    });
    expect(rejectionMessage(resolveSource("http://127.0.0.1:8710/api/command-floor"))).toMatch(/loopback/);
  });

  it("does not build a rollup URL for loopback", () => {
    expect(simulateEndpoint("http://127.0.0.1:8710/api/command-floor")).toBeNull();
    expect(simulateEndpoint("https://api.example.com/api/command-floor")).toBe(
      "https://api.example.com/api/simulate-ed-rollup",
    );
  });

  it("redacts addresses in display text", () => {
    expect(sensitiveKind("app-host-1")).toBeNull();
    expect(sensitiveKind("Oct 19 Inventory & Tailscale Mesh Ecosystem")).toBeNull();
    expect(sensitiveKind("10.1.2.3")).toBe("ipv4");
    expect(sensitiveKind("ops@example.com")).toBe("email");
  });
});
