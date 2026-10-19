import { describe, expect, it } from "vitest";
import seedJson from "../../../data/command-floor.json";
import { DIMMED_OPACITY, objectOpacity, sceneObjects } from "./match";
import { getBundledFloor, refreshedSeed } from "./load";
import { defaultSelection, toInspector } from "./inspector";
import { sensitiveKind } from "./publicText";
import { rejectionMessage, resolveSource, simulateEndpoint } from "./source";
import { computeCounts } from "./counts";

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
}

describe("command floor seed", () => {
  const floor = getBundledFloor();

  it("computes 3 red, 7 waiting, 14 open PRs, and 28 total", () => {
    expect(floor.title).toBe("Virtual Command Floor");
    expect(floor.subtitle).toBe("Projects, databases and AI agents - seed from the Oct 19, 2026 inventory");
    expect(floor.project_pads).toHaveLength(9);
    expect(floor.database_racks).toHaveLength(5);
    expect(floor.agents).toHaveLength(14);
    expect(floor.counts).toEqual({ red_alerts: 3, waiting_samuel: 7, open_prs: 14, total: 28 });
    expect(floor.counts).toEqual(computeCounts(floor));
    expect(floor.checks).toEqual({ postgres: "not_run", loom: "not_run", github: "not_run", checked_at: null });
  });

  it("keeps rack names, repo lists, and the Sam ERP inspector default", () => {
    expect(floor.database_racks.map((rack) => rack.name)).toEqual([
      "Sam ERP",
      "Loom Postgres",
      "MGE hub data",
      "Odoo",
      "Sam ERP box copy",
    ]);
    expect(floor.project_pads.find((pad) => pad.id === "gold-elite")?.repos).toEqual([
      "gold-elite-landing",
      "Gold-Elite-Website",
    ]);
    const selection = defaultSelection(floor);
    expect(selection).toEqual({ kind: "pad", id: "sam-erp" });
    const card = toInspector(selection, floor);
    expect(card.title).toBe("Sam ERP App");
    expect(card.erp).toBe("1");
    expect(card.stage).toBe("Entregado");
    expect(card.level).toBe("WARNING");
    expect(card.action).toBeTruthy();
  });

  it("reloads the same seed on rollup", () => {
    const next = refreshedSeed(new Date("2026-10-19T12:00:00.000Z"));
    expect(next.project_pads).toEqual(floor.project_pads);
    expect(next.database_racks).toEqual(floor.database_racks);
    expect(next.agents).toEqual(floor.agents);
    expect(next.counts).toEqual(floor.counts);
    expect(next.checks.postgres).toBe("not_run");
    expect(next.checks.loom).toBe("not_run");
    expect(next.checks.github).toBe("not_run");
    expect(next.checks.checked_at).toBe("2026-10-19T12:00:00.000Z");
  });

  it("has no IP addresses or email addresses", () => {
    const texts: string[] = [];
    collectStrings(seedJson, texts);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text, text).not.toMatch(IPV4);
      expect(text, text).not.toMatch(EMAIL);
      expect(sensitiveKind(text), text).not.toBe("ipv4");
      expect(sensitiveKind(text), text).not.toBe("email");
    }
    expect(sensitiveKind("limit Postgres to localhost / Tailscale")).toBeNull();
  });

  it("dims only the objects outside the active filter", () => {
    for (const item of sceneObjects(floor, "all")) expect(item.opacity).toBe(1);
    for (const filter of ["red", "waiting", "prs"] as const) {
      const opacities = sceneObjects(floor, filter).map((item) => item.opacity);
      expect(opacities).toContain(1);
      expect(opacities).toContain(DIMMED_OPACITY);
      expect(new Set(opacities)).toEqual(new Set([1, DIMMED_OPACITY]));
    }
    expect(objectOpacity("pad", "mge-triage-hub", "red", floor)).toBe(1);
    expect(objectOpacity("pad", "gold-elite", "red", floor)).toBe(DIMMED_OPACITY);
    expect(objectOpacity("pad", "gold-elite", "prs", floor)).toBe(DIMMED_OPACITY);
    expect(objectOpacity("pawn", "web-dev", "waiting", floor)).toBe(1);
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
    expect(sensitiveKind("0.0.0.0")).toBe("ipv4");
    expect(sensitiveKind("[::1]")).toBe("loopback");
  });
});
