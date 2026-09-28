// Client-side event sanitizer (defense in depth: anyone holding the relay topic could post to it).
// Mirrors shared/heartbeat.py in division-one-bots: whitelist fields, known nodes, generic steps, small int counts.
export const ALLOWED = new Set(["v", "ts", "bot", "type", "run_id", "step", "exit_code", "to", "counts", "demo", "duration_s"]);
export const TYPES = new Set(["start", "finish", "error", "handoff", "step", "skipped", "snapshot"]);
const PII = [/\+?\d[\d\s().-]{8,}\d/, /\b\d{3}-?\d{2}-?\d{4}\b/, /\d{5,}/, /[^@\s]+@[^@\s]+\.[a-z]{2,}/i, /[$€£]|\busd\b/i];
const COUNT_KEY = /^[a-z][a-z_]{0,31}$/;
const BAD_COUNT_WORDS = ["amount", "usd", "dollar", "balance", "income", "wage", "salary", "ssn", "itin", "phone", "name", "email", "address", "account", "subject", "file"];
const isInt = (x) => typeof x === "number" && Number.isInteger(x);
const safeStr = (s, max = 48) => typeof s === "string" && s.length > 0 && s.length <= max && !PII.some((p) => p.test(s));

/** Returns a clean event or null. nodes: Set of node ids; steps: Set of allowed step names. */
export function sanitizeEvent(e, nodes, steps) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return null;
  for (const k of Object.keys(e)) if (!ALLOWED.has(k)) return null;
  if (e.v !== 1 || !TYPES.has(e.type)) return null;
  if (typeof e.ts !== "number" || !isFinite(e.ts) || Math.abs(e.ts - Date.now() / 1000) > 400 * 86400) return null;
  const out = { v: 1, ts: Math.floor(e.ts), type: e.type };
  for (const f of ["bot", "to"]) {
    if (f in e) { if (!safeStr(e[f]) || !nodes.has(e[f])) return null; out[f] = e[f]; }
  }
  if (!out.bot) return null;
  if (out.type === "handoff" && !out.to) return null;
  if ("run_id" in e) { if (typeof e.run_id !== "string" || !/^[a-z0-9]{4,8}$/.test(e.run_id)) return null; out.run_id = e.run_id; }
  if ("step" in e) { if (!safeStr(e.step, 40) || !steps.has(e.step)) return null; out.step = e.step; }
  if ("exit_code" in e) { if (!isInt(e.exit_code) || e.exit_code < 0 || e.exit_code > 255) return null; out.exit_code = e.exit_code; }
  if ("duration_s" in e) { if (typeof e.duration_s !== "number" || e.duration_s < 0 || e.duration_s > 7 * 86400) return null; out.duration_s = Math.floor(e.duration_s); }
  if ("demo" in e) { if (typeof e.demo !== "boolean") return null; if (e.demo) out.demo = true; }
  if ("counts" in e) {
    const c = e.counts;
    if (!c || typeof c !== "object" || Array.isArray(c) || Object.keys(c).length > 12) return null;
    const clean = {};
    for (const [k, v] of Object.entries(c)) {
      if (!COUNT_KEY.test(k) || BAD_COUNT_WORDS.some((w) => k.includes(w))) return null;
      if (!isInt(v) || v < 0 || v > 99999) return null;
      clean[k] = v;
    }
    if (Object.keys(clean).length) out.counts = clean;
  }
  return out;
}

export const eventKey = (e) => [e.bot, e.type, e.run_id ?? "", e.ts, e.to ?? "", e.step ?? ""].join("|");
