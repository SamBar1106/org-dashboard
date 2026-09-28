// Division One live org dashboard. No build step, no dependencies.
// Data: data/org.json + data/status.json (snapshot published from the private repo) + live events from the
// ntfy.sh relay (EventSource, replaying the last 12h). The relay topic comes from the share link (#k=...).
import { sanitizeEvent, eventKey } from "./sanitize.js";

const TZ = "America/Chicago";
const RELAY = "https://ntfy.sh";
const SVGNS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);

const S = {
  org: null, snap: null, nodes: new Map(), nodeIds: new Set(), steps: new Set(),
  events: new Map(), win: 86400, selected: null, hot: new Map(), topic: null, es: null, conn: "off",
  pos: new Map(), liveKeys: new Set(),
};

// ---------- time helpers (Central Time) ----------
const fmtTime = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const fmtFull = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
const now = () => Date.now() / 1000;
function ctParts(tsMs) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(tsMs)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
function offsetMs(tsMs) { const p = ctParts(tsMs); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(tsMs / 1000) * 1000; }
function ctToEpoch(y, m, d, h, mi) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMs(guess);
  const off2 = offsetMs(t);
  if (guess - off2 !== t) t = guess - off2;
  return t / 1000;
}
const ago = (s) => { s = Math.max(0, Math.round(s)); if (s < 90) return `${s}s ago`; if (s < 5400) return `${Math.round(s / 60)}m ago`; if (s < 172800) return `${Math.round(s / 3600)}h ago`; return `${Math.round(s / 86400)}d ago`; };
const dur = (s) => { s = Math.round(s); if (s < 90) return `${s}s`; if (s < 5400) return `${Math.round(s / 60)}m`; return `${(s / 3600).toFixed(1)}h`; };

// Scheduled occurrences (CT) between a and b (epoch seconds).
function occurrences(sch, a, b) {
  if (!sch || !sch.time) return [];
  const [hh, mm] = sch.time.split(":").map(Number);
  const out = [];
  for (let t = b + 86400; t >= a - 86400; t -= 86400) {
    const p = ctParts(t * 1000);
    if (sch.kind === "weekly" && p.wd !== sch.dow) continue;
    const occ = ctToEpoch(p.y, p.m, p.d, hh, mm);
    if (occ >= a && occ <= b && !out.includes(occ)) out.push(occ);
  }
  return out.sort((x, y) => x - y);
}

// ---------- runs & state ----------
function runsFor(id, includeOldDemo = true) {
  const runs = new Map(), points = [];
  const gen = S.snap ? S.snap.generated_ts : 0;
  for (const e of S.events.values()) {
    if (e.bot !== id || e.type === "snapshot") continue;
    if (!includeOldDemo && e.demo && e.ts <= gen) continue;
    if (e.run_id && (e.type === "start" || e.type === "finish" || e.type === "error")) {
      const r = runs.get(e.run_id) || { id: e.run_id, start: null, end: null, failed: false, demo: !!e.demo, exit: null, counts: null };
      if (e.type === "start") r.start = e.ts;
      else { r.end = e.ts; r.failed = e.type === "error" || (e.exit_code ?? 0) !== 0; r.exit = e.exit_code ?? null; r.counts = e.counts || null; if (r.start == null) r.start = e.ts - (e.duration_s || 0); }
      r.demo = r.demo || !!e.demo;
      runs.set(e.run_id, r);
    } else points.push(e);
  }
  return { runs: [...runs.values()].filter((r) => r.start != null).sort((a, b) => a.start - b.start), points: points.sort((a, b) => a.ts - b.ts) };
}

function missedOccurrences(node, a, b) {
  if (!node.schedule || node.status !== "live") return [];
  const grace = (S.org.missed_grace_minutes || 60) * 60;
  const { runs, points } = runsFor(node.id, false);
  const starts = runs.map((r) => r.start).concat(points.filter((p) => p.type === "skipped").map((p) => p.ts));
  // Only judge occurrences after monitoring began: the bot's first known run, or the last 36h if none is on record.
  const since = starts.length ? Math.min(...starts) - 3600 : now() - 36 * 3600;
  return occurrences(node.schedule, Math.max(a, since), b).filter((occ) => now() > occ + grace && !starts.some((t) => t >= occ - 3600 && t <= occ + 20 * 3600));
}

function nodeState(node) {
  const t = now();
  const { runs, points } = runsFor(node.id, false);
  const last = runs[runs.length - 1];
  const info = { last, runs };
  if (last && last.end == null) {
    const el = t - last.start;
    return { ...info, state: el > node.expected_minutes * 60 ? "stuck" : "working", detail: el > node.expected_minutes * 60 ? `no finish after ${dur(el)} (expected ≤ ${node.expected_minutes}m)` : `working for ${dur(el)}` };
  }
  const recentStep = points.filter((p) => p.type === "step" && t - p.ts < 120).pop();
  if (recentStep) return { ...info, state: "working", detail: `step: ${recentStep.step || "working"}` };
  if (last && last.failed && t - last.end < 7 * 86400) return { ...info, state: "error", detail: `last run failed (exit ${last.exit ?? "?"})` };
  const recentOcc = occurrences(node.schedule, t - 8 * 86400, t).pop();
  const missed = recentOcc ? missedOccurrences(node, recentOcc - 1, t) : [];
  if (missed.length) return { ...info, state: "missed", detail: `missed scheduled run at ${fmtFull.format(new Date(missed[missed.length - 1] * 1000))} CT` };
  const base = { live: "idle", assistant: "assistant", manual: "manual", disabled: "disabled", planned: "planned" }[node.status] || "idle";
  return { ...info, state: base, detail: node.status_text };
}

const STATE_LABEL = { idle: "idle", assistant: "assistant", manual: "on demand", disabled: "disabled", planned: "planned", working: "working", stuck: "STUCK", error: "ERROR", missed: "MISSED" };
const STATE_BADGE = { working: "⚙️", stuck: "⚠️", error: "⚠️", missed: "⏰", disabled: "🔒", planned: "🚧", idle: "", assistant: "", manual: "" };

// ---------- SVG helpers ----------
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function txt(tag, attrs, text, parent) { const n = el(tag, attrs, parent); n.textContent = text; return n; }

const ROOMS = {
  "bot-development": [20, 20, 370, 220], sales: [410, 20, 380, 220], treasury: [810, 20, 370, 220],
  shared: [20, 260, 370, 280], executive: [410, 260, 380, 280], "quality-control": [810, 260, 370, 280],
  production: [20, 560, 770, 220], "brand-marketing": [810, 560, 370, 220],
};

function layout() {
  S.pos.clear();
  for (const d of S.org.divisions) {
    const r = ROOMS[d.id]; if (!r) continue;
    const members = S.org.nodes.filter((n) => n.division === d.id);
    const hub = members.find((n) => n.id === "executive-hub");
    const rest = members.filter((n) => n !== hub);
    const [x, y, w, h] = r;
    const top = y + 62;
    if (hub) {
      S.pos.set(hub.id, { x: x + w / 2, y: top + 45, r: 40 });
      const side = rest.filter((n) => n.kind !== "teammate"), row = rest.filter((n) => n.kind === "teammate");
      side.forEach((n, i) => S.pos.set(n.id, { x: i % 2 ? x + w - 58 : x + 58, y: top + 40 + Math.floor(i / 2) * 80, r: 26 }));
      row.forEach((n, i) => S.pos.set(n.id, { x: x + (w / (row.length + 1)) * (i + 1), y: top + 150, r: 26 }));
    } else {
      const cols = Math.max(1, Math.min(rest.length, Math.floor(w / 115)));
      const rows = Math.ceil(rest.length / cols);
      rest.forEach((n, i) => {
        const c = i % cols, rr = Math.floor(i / cols);
        const inRow = Math.min(cols, rest.length - rr * cols);
        S.pos.set(n.id, { x: x + (w / (inRow + 1)) * (c + 1), y: top + 45 + rr * 105 + (rows === 1 ? (h - 62 - 110) / 2 : 0), r: 30 });
      });
    }
  }
}

function drawFloor() {
  const svg = $("floor");
  svg.replaceChildren();
  const defs = el("defs", {}, svg);
  const pat = el("pattern", { id: "tiles", width: 40, height: 40, patternUnits: "userSpaceOnUse" }, defs);
  el("rect", { width: 40, height: 40, fill: "#141b2b" }, pat);
  el("path", { d: "M40 0H0V40", fill: "none", stroke: "#1c2539", "stroke-width": 1 }, pat);
  for (const d of S.org.divisions) {
    const r = ROOMS[d.id]; if (!r) continue;
    const g = el("g", { class: "room" }, svg);
    el("rect", { class: "floorrect", x: r[0], y: r[1], width: r[2], height: r[3], rx: 14 }, g);
    txt("text", { class: "rt", x: r[0] + 14, y: r[1] + 24 }, `${d.icon} ${d.num ? d.num + " · " : ""}${d.name}`, g);
    txt("text", { class: "rp", x: r[0] + 14, y: r[1] + 42 }, d.purpose, g);
  }
  const eg = el("g", { id: "edges" }, svg);
  S.org.edges.forEach((e, i) => {
    const a = S.pos.get(e.from), b = S.pos.get(e.to); if (!a || !b) return;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(60, len * 0.15);
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    const p = el("path", { id: `edge-${i}`, class: "edge", d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}` }, eg);
    e._el = p; e._mid = { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y };
    const t = document.createElementNS(SVGNS, "title"); t.textContent = `${label(e.from)} → ${label(e.to)}: ${e.label}`; p.appendChild(t);
  });
  el("g", { id: "edgeFx" }, svg);
  const ng = el("g", { id: "nodes" }, svg);
  for (const n of S.org.nodes) {
    const p = S.pos.get(n.id); if (!p) continue;
    const g = el("g", { class: "node", id: `node-${n.id}`, transform: `translate(${p.x},${p.y})`, tabindex: 0 }, ng);
    el("circle", { class: "ring", r: p.r }, g);
    el("circle", { class: "body", r: p.r }, g);
    txt("text", { class: "emo", y: 1, style: p.r > 30 ? "font-size:38px" : "" }, n.emoji, g);
    const lines = wrapLabel(n.label, 16);
    const lt = el("text", { class: "lbl", y: p.r + 15 }, g);
    lines.forEach((ln, i) => { const ts = el("tspan", { x: 0, dy: i ? 13 : 0 }, lt); ts.textContent = ln; });
    txt("text", { class: "st", y: p.r + 28 + (lines.length - 1) * 13 }, "", g);
    txt("text", { class: "badge", x: p.r * 0.55, y: -p.r * 0.6 }, "", g);
    const tt = document.createElementNS(SVGNS, "title"); tt.textContent = n.label; g.appendChild(tt);
    g.addEventListener("click", () => select(n.id));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter") select(n.id); });
  }
}
function wrapLabel(t, max) {
  if (t.length <= max) return [t];
  const words = t.split(" "); const out = [""];
  for (const w of words) { const cur = out[out.length - 1]; if (cur && (cur + " " + w).length > max) out.push(w); else out[out.length - 1] = cur ? cur + " " + w : w; }
  return out.slice(0, 2);
}
const label = (id) => (S.nodes.get(id) || { label: id }).label;

function renderStates() {
  const counts = { working: 0, alert: 0, idle: 0, disabled: 0, planned: 0 };
  const states = new Map();
  for (const n of S.org.nodes) {
    const st = nodeState(n); states.set(n.id, st);
    const g = $(`node-${n.id}`); if (!g) continue;
    const cls = `node s-${st.state}${S.selected === n.id ? " sel" : ""}`;
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
    g.querySelector("text.st").textContent = STATE_LABEL[st.state];
    g.querySelector("text.badge").textContent = STATE_BADGE[st.state] || (n.flags.includes("frozen") ? "🧊" : "");
    g.querySelector("title").textContent = `${n.label}: ${STATE_LABEL[st.state]} (${st.detail})`;
    if (st.state === "working") counts.working++; else if (["stuck", "error", "missed"].includes(st.state)) counts.alert++;
    else if (st.state === "disabled") counts.disabled++; else if (st.state === "planned") counts.planned++; else counts.idle++;
  }
  const t = now();
  for (const e of S.org.edges) {
    if (!e._el) continue;
    const a = S.nodes.get(e.from), b = S.nodes.get(e.to);
    const dim = a.status === "planned" || b.status === "planned";
    const hot = (S.hot.get(`${e.from}>${e.to}`) || 0) > t;
    const warm = !hot && states.get(e.from)?.state === "working";
    const cls = `edge${dim ? " dim" : ""}${hot ? " hot" : warm ? " warm" : ""}`;
    if (e._el.getAttribute("class") !== cls) e._el.setAttribute("class", cls);
  }
  $("counts").textContent = `⚙️ ${counts.working} working · ${counts.alert ? "🔴 " + counts.alert + " alert · " : ""}${counts.idle} ready · ${counts.disabled} disabled · ${counts.planned} planned`;
  $("clock").textContent = `${fmtTime.format(new Date())} CT`;
  if (S.snap) $("snapAge").textContent = `snapshot ${ago(t - S.snap.generated_ts)}`;
  if (S.selected) renderDetails(states.get(S.selected));
  return states;
}

function flashEdge(from, to, step) {
  let e = S.org.edges.find((x) => x.from === from && x.to === to) || S.org.edges.find((x) => x.from === to && x.to === from);
  if (!e || !e._el) return;
  const until = now() + 8;
  S.hot.set(`${e.from}>${e.to}`, until);
  const fx = $("edgeFx");
  const dot = el("circle", { class: "packet", r: 7 }, fx);
  const am = el("animateMotion", { dur: "1.4s", repeatCount: "4", path: e._el.getAttribute("d"), keyPoints: e.from === from ? "0;1" : "1;0", keyTimes: "0;1", calcMode: "linear" }, dot);
  const lbl = txt("text", { class: "edge-label", x: e._mid.x, y: e._mid.y - 8 }, step || e.label, fx);
  try { am.beginElement(); } catch (_) {}
  setTimeout(() => { dot.remove(); lbl.remove(); renderStates(); }, 6000);
  renderStates();
}

// ---------- details, feed, timeline ----------
function select(id) { S.selected = S.selected === id ? null : id; renderStates(); if (!S.selected) $("details").replaceChildren(h("h2", "Details"), h("p", "Tap a bot to see its status, schedule and last run.", "muted")); }
function h(tag, text, cls) { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
function renderDetails(st) {
  const n = S.nodes.get(S.selected); if (!n || !st) return;
  const d = $("details"); const div = S.org.divisions.find((x) => x.id === n.division);
  const dl = h("dl");
  const row = (k, v) => { if (v == null || v === "") return; dl.append(h("dt", k), h("dd", String(v))); };
  row("Division", div ? `${div.num ? div.num + " · " : ""}${div.name}` : n.division);
  row("State", `${STATE_LABEL[st.state]}: ${st.detail}`);
  row("Config", n.status_text);
  row("Schedule", n.schedule_text ? `${n.schedule_text}` : "none");
  row("Stuck after", `${n.expected_minutes} min`);
  const lr = st.last;
  if (lr) {
    row("Last run", `${fmtFull.format(new Date(lr.start * 1000))} CT${lr.demo ? " (demo)" : ""}`);
    row("Result", lr.end == null ? "running" : `${lr.failed ? "failed" : "ok"}${lr.exit != null ? " (exit " + lr.exit + ")" : ""}, took ${dur(lr.end - lr.start)}`);
    if (lr.counts) row("Counts", Object.entries(lr.counts).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", "));
  } else row("Last run", "no runs in the last 7 days");
  row("Runs (7d)", st.runs.filter((r) => !r.demo).length);
  row("Notes", [...n.notes, ...n.flags].join("; "));
  d.replaceChildren(h("h2", `${n.emoji} ${n.label}`), dl);
}

function renderFeed() {
  const list = [...S.events.values()].filter((e) => e.type !== "snapshot").sort((a, b) => b.ts - a.ts).slice(0, 60);
  const ol = $("feed"); ol.replaceChildren();
  let lastDay = "";
  for (const e of list) {
    const day = fmtDay.format(new Date(e.ts * 1000));
    if (day !== lastDay) { const li = h("li", day, "muted small"); ol.append(li); lastDay = day; }
    const li = h("li"); if (S.liveKeys.has(eventKey(e))) li.classList.add("new");
    const n = S.nodes.get(e.bot);
    li.append(h("span", fmtTime.format(new Date(e.ts * 1000)), "t"), h("span", `${n.emoji} ${n.label}`), h("span", e.type, `tag ${e.type}`));
    if (e.to) li.append(h("span", `→ ${label(e.to)}`));
    if (e.step && e.step !== "run") li.append(h("span", e.step, "muted"));
    if (e.exit_code != null && e.exit_code !== 0) li.append(h("span", `exit ${e.exit_code}`, "tag error"));
    if (e.duration_s != null) li.append(h("span", dur(e.duration_s), "muted"));
    if (e.counts) li.append(h("span", Object.entries(e.counts).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · "), "muted small"));
    if (e.demo) li.append(h("span", "DEMO", "tag demo"));
    ol.append(li);
  }
  if (!list.length) ol.append(h("li", "No events yet.", "muted"));
}

function renderTimeline() {
  const svg = $("timeline"); const W = Math.max(320, $("timelineWrap").clientWidth);
  const L = W < 600 ? 110 : 170, R = W < 600 ? 44 : 70, rowH = 24, top = 24;
  const t1 = now(), t0 = t1 - S.win, x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const rows = S.org.nodes.filter((n) => n.status !== "planned" || runsFor(n.id).runs.length);
  const Ht = top + rows.length * rowH + 8;
  svg.setAttribute("viewBox", `0 0 ${W} ${Ht}`); svg.setAttribute("height", Ht); svg.replaceChildren();
  const defs = el("defs", {}, svg);
  const hp = el("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 6, height: 6, fill: "#5b3fa8" }, hp); el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#c4b5fd", "stroke-width": 2 }, hp);
  const step = S.win <= 3600 ? 600 : S.win <= 86400 ? 3 * 3600 : 86400;
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
    let tt = t;
    if (step >= 3600) { const p = ctParts(t * 1000); if (step === 86400) { tt = ctToEpoch(p.y, p.m, p.d, 0, 0); if (tt < t0) continue; } }
    el("line", { class: "grid", x1: x(tt), x2: x(tt), y1: top - 6, y2: Ht - 6 }, svg);
    txt("text", { x: x(tt) + 3, y: 12 }, step === 86400 ? fmtDay.format(new Date(tt * 1000)) : fmtTime.format(new Date(tt * 1000)), svg);
  }
  el("line", { class: "now", x1: x(t1), x2: x(t1), y1: top - 6, y2: Ht - 6 }, svg);
  rows.forEach((n, i) => {
    const y = top + i * rowH;
    txt("text", { class: "rowlbl", x: 4, y: y + 15 }, `${n.emoji} ${W < 600 ? n.label.slice(0, 13) : n.label}`, svg);
    el("line", { class: "grid", x1: L, x2: W - R, y1: y + rowH - 1, y2: y + rowH - 1, opacity: 0.4 }, svg);
    const { runs, points } = runsFor(n.id);
    let busy = 0;
    for (const r of runs) {
      const end = r.end ?? t1; if (end < t0) continue;
      const s = Math.max(r.start, t0); busy += r.demo ? 0 : end - s;
      const open = r.end == null, stuck = open && t1 - r.start > n.expected_minutes * 60;
      const cls = r.demo ? "bar-demo" : r.failed || stuck ? (open ? "bar-stuck" : "bar-err") : open ? "bar-open" : "bar-ok";
      const b = el("rect", { class: cls, x: x(s), y: y + 5, width: Math.max(3, x(end) - x(s)), height: rowH - 10, rx: 3 }, svg);
      const tt = document.createElementNS(SVGNS, "title");
      tt.textContent = `${n.label}${r.demo ? " (DEMO)" : ""}: ${fmtFull.format(new Date(r.start * 1000))} CT, ${open ? "running" : dur(end - r.start)}${r.failed ? ", failed" : ""}`;
      b.appendChild(tt);
    }
    for (const p of points) {
      if (p.ts < t0) continue;
      if (p.type === "handoff") el("path", { class: "hand", d: `M${x(p.ts)} ${y + 6} l5 6 -5 6 -5 -6z`, opacity: p.demo ? 0.6 : 1 }, svg);
      else if (p.type === "skipped") el("rect", { class: "skip", x: x(p.ts) - 1, y: y + 6, width: 2, height: rowH - 12 }, svg);
      else if (p.type === "step") el("circle", { class: p.demo ? "bar-demo" : "bar-ok", cx: x(p.ts), cy: y + rowH / 2, r: 3 }, svg);
    }
    for (const occ of missedOccurrences(n, t0, t1)) {
      const cx = x(occ), cy = y + rowH / 2;
      el("path", { class: "miss", d: `M${cx - 5} ${cy - 5}L${cx + 5} ${cy + 5}M${cx + 5} ${cy - 5}L${cx - 5} ${cy + 5}` }, svg);
    }
    if (busy > 0) txt("text", { x: W - R + 6, y: y + 15 }, dur(busy), svg);
  });
}

function renderLegend() {
  const items = [["working", "#34d399"], ["idle (live)", "#60a5fa"], ["assistant", "#a78bfa"], ["on demand", "#2dd4bf"], ["disabled", "#6b7280"], ["planned", "#374151"], ["stuck / error / missed", "#f43f5e"]];
  $("legend").replaceChildren(...items.map(([t, c]) => { const s = h("span"); const i = h("i"); i.style.borderColor = c; s.append(i, document.createTextNode(t)); return s; }), h("span", "🧊 frozen · ◆ handoff lights the edge"));
}

// ---------- data ----------
function addEvent(raw, live) {
  const e = sanitizeEvent(raw, S.nodeIds, S.steps); if (!e) return false;
  const k = eventKey(e); if (S.events.has(k)) return false;
  S.events.set(k, e);
  if (live) {
    S.liveKeys.add(k);
    if (e.type === "handoff" && now() - e.ts < 60) flashEdge(e.bot, e.to, e.step);
    if (e.type === "snapshot") { setTimeout(loadSnapshot, 45000); setTimeout(loadSnapshot, 120000); }
  }
  return true;
}

async function fetchJSON(path) {
  const r = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function loadSnapshot() {
  try {
    const snap = await fetchJSON("data/status.json");
    if (S.snap && snap.generated_ts <= S.snap.generated_ts) return;
    S.snap = snap;
    for (const e of snap.events || []) addEvent(e, false);
    refresh();
  } catch (err) { console.warn(err); }
}

function connect() {
  if (!S.topic) { setConn("none"); return; }
  try { S.es && S.es.close(); } catch (_) {}
  setConn("off");
  const es = new EventSource(`${RELAY}/${encodeURIComponent(S.topic)}/sse?since=12h`);
  S.es = es;
  const onMsg = (m) => {
    try {
      const msg = JSON.parse(m.data);
      if (msg.event && msg.event !== "message") return;
      setConn("live");
      if (addEvent(JSON.parse(msg.message), true)) refresh();
    } catch (_) {}
  };
  es.onmessage = onMsg;
  es.addEventListener("open", () => setConn("live"));
  es.addEventListener("keepalive", () => setConn("live"));
  es.onopen = () => setConn("live");
  es.onerror = () => setConn("off");
}
function setConn(c) {
  S.conn = c; const n = $("conn");
  n.className = `chip conn-${c}`;
  n.textContent = c === "live" ? "● LIVE" : c === "off" ? "● reconnecting…" : "● snapshot only";
  $("banner").classList.toggle("hidden", c !== "none");
  if (c === "none") $("banner").textContent = "Live updates need the full share link (it ends with #k=…). Showing the published snapshot; it refreshes every few minutes.";
}

let pending = null;
function refresh() { if (pending) return; pending = requestAnimationFrame(() => { pending = null; renderStates(); renderFeed(); renderTimeline(); }); }

async function main() {
  const m = /[#&]k=([A-Za-z0-9_-]{16,64})/.exec(location.hash);
  if (m) { S.topic = m[1]; try { localStorage.setItem("d1-topic", S.topic); } catch (_) {} }
  else { try { S.topic = localStorage.getItem("d1-topic"); } catch (_) {} }
  S.org = await fetchJSON("data/org.json");
  S.org.nodes.forEach((n) => { S.nodes.set(n.id, n); S.nodeIds.add(n.id); });
  S.steps = new Set(S.org.steps || []);
  $("subtitle").textContent = S.org.title;
  layout(); drawFloor(); renderLegend();
  await loadSnapshot();
  refresh();
  connect();
  document.querySelectorAll("#windowSel button").forEach((b) => b.addEventListener("click", () => {
    S.win = +b.dataset.w; document.querySelectorAll("#windowSel button").forEach((x) => x.classList.toggle("on", x === b)); renderTimeline();
  }));
  setInterval(renderStates, 1000);
  setInterval(renderTimeline, 15000);
  setInterval(loadSnapshot, 180000);
  window.addEventListener("resize", () => renderTimeline());
  window.addEventListener("hashchange", () => location.reload());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadSnapshot(); if (S.topic && (!S.es || S.es.readyState === 2)) connect(); } });
}
main().catch((err) => { const b = $("banner"); b.classList.remove("hidden"); b.textContent = `Could not load the dashboard data (${err.message}).`; });
