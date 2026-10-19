import seedJson from "../../../data/command-floor.json";
import { floorFromUnknown } from "./validate";
import type { FloorModel } from "./types";

export function getBundledFloor(): FloorModel {
  return floorFromUnknown(seedJson);
}

/** Local stand-in for ED morning rollup: reload the seed and stamp the time. Checks stay not_run. */
export function refreshedSeed(now = new Date()): FloorModel {
  const next = floorFromUnknown(seedJson);
  next.checks = { ...next.checks, checked_at: now.toISOString() };
  return next;
}
