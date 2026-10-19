import type { NavId } from "../state/store";

export const NAV_ITEMS: { id: NavId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "traces", label: "Traces" },
  { id: "graph", label: "Trace graph" },
  { id: "timeline", label: "Timeline" },
  { id: "procedures", label: "Procedures" },
  { id: "approvals", label: "Approvals" },
  { id: "agents", label: "Agents" },
  { id: "settings", label: "Settings" },
];
