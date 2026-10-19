import { resolveSource } from "./source";

/** Live Ops needs a private https data API and a separate https login URL. */
export function liveOpsReady(apiUrl: string | undefined | null, loginUrl: string | undefined | null): boolean {
  return resolveSource(apiUrl).kind === "remote" && resolveSource(loginUrl).kind === "remote";
}
