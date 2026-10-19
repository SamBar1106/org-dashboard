import { refreshedSeed } from "./load";
import { resolveSource } from "./source";
import type { FloorModel } from "./types";
import { floorFromUnknown } from "./validate";

export type FetchResult =
  | { kind: "floor"; floor: FloorModel; note: string }
  | { kind: "skip" }
  | { kind: "error"; message: string };

export async function fetchFloor(envUrl: string | undefined, reason: "boot" | "ping"): Promise<FetchResult> {
  const source = resolveSource(envUrl);
  if (source.kind !== "remote") {
    if (reason === "ping") return { kind: "floor", floor: refreshedSeed(), note: "Live ping reloaded the seed" };
    return { kind: "skip" };
  }
  try {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(String(response.status));
    const floor = floorFromUnknown(await response.json());
    const note = reason === "boot" ? "Live source loaded" : "Live ping loaded the remote floor";
    return { kind: "floor", floor, note };
  } catch {
    const message = reason === "boot"
      ? "Live source unavailable. Showing the published seed."
      : "Live source unavailable. Showing the current floor.";
    return { kind: "error", message };
  }
}
