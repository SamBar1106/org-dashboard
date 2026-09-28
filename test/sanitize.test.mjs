import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeEvent } from "../sanitize.js";

const nodes = new Set(["quality-control", "executive-hub", "sales"]);
const steps = new Set(["run", "daily report", "demo"]);
const now = Math.floor(Date.now() / 1000);
const ok = { v: 1, ts: now, bot: "quality-control", type: "start", run_id: "ab12cd34", step: "run" };

test("accepts generic events", () => {
  assert.deepEqual(sanitizeEvent(ok, nodes, steps), ok);
  assert.ok(sanitizeEvent({ ...ok, type: "finish", exit_code: 0, counts: { tickets_created: 0 } }, nodes, steps));
  assert.ok(sanitizeEvent({ ...ok, type: "handoff", to: "executive-hub", step: "daily report", demo: true }, nodes, steps));
});
test("rejects client-data shapes and unknown fields", () => {
  for (const bad of [
    { ...ok, client: "Jane" }, { ...ok, message: "<img src=x onerror=alert(1)>" }, { ...ok, step: "+1 727-555-0142" },
    { ...ok, step: "123-45-6789" }, { ...ok, bot: "jane-doe" }, { ...ok, counts: { amount: 5 } },
    { ...ok, counts: { tickets: 1.5 } }, { ...ok, type: "handoff" }, { ...ok, step: "Karen refund" },
    { ...ok, run_id: "3125550199" }, { ...ok, ts: "now" }, null, [], "x",
  ]) assert.equal(sanitizeEvent(bad, nodes, steps), null, JSON.stringify(bad));
});
