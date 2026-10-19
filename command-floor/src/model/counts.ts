import type { CommandFloorData, Counts } from "./types";

/** Mirrors the API: counts are derived on read and are never stored in the seed. */
export function computeCounts(data: CommandFloorData): Counts {
  let redAlerts = 0;
  for (const pad of data.project_pads) {
    if (pad.level === "CRITICAL") redAlerts += 1;
  }
  for (const rack of data.database_racks) {
    if (rack.level === "CRITICAL") redAlerts += 1;
  }
  let waitingSamuel = 0;
  for (const agent of data.agents) {
    if (agent.state === "red_alert") redAlerts += 1;
    if (agent.state === "waiting_samuel") waitingSamuel += 1;
  }
  let openPrs = 0;
  for (const pad of data.project_pads) openPrs += pad.open_pr_count ?? 0;
  return {
    red_alerts: redAlerts,
    waiting_samuel: waitingSamuel,
    open_prs: openPrs,
    total: data.project_pads.length + data.database_racks.length + data.agents.length,
  };
}
