const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

export type DataSource =
  | { kind: "seed" }
  | { kind: "remote"; url: string }
  | { kind: "rejected"; url: string; reason: "loopback" | "not-https" | "invalid" };

export function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return LOOPBACK.has(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/** Build-time switch. Loopback and non-https URLs never become a fetch target. */
export function resolveSource(envUrl: string | undefined | null): DataSource {
  const trimmed = (envUrl ?? "").trim();
  if (!trimmed) return { kind: "seed" };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: "rejected", url: trimmed, reason: "invalid" };
  }
  if (url.username || url.password) return { kind: "rejected", url: trimmed, reason: "invalid" };
  if (isLoopbackUrl(trimmed)) return { kind: "rejected", url: trimmed, reason: "loopback" };
  if (url.protocol !== "https:") return { kind: "rejected", url: trimmed, reason: "not-https" };
  return { kind: "remote", url: url.toString() };
}

export function rejectionMessage(source: DataSource): string | null {
  if (source.kind !== "rejected") return null;
  switch (source.reason) {
    case "loopback":
      return "Ignoring a loopback command-floor URL. Showing the published seed.";
    case "not-https":
      return "Command-floor URL must be https. Showing the published seed.";
    case "invalid":
      return "Command-floor URL was not usable. Showing the published seed.";
    default: {
      const neverReason: never = source.reason;
      return neverReason;
    }
  }
}

/** POST target for a configured GET URL. Null when the URL is not a safe remote command-floor endpoint. */
export function simulateEndpoint(getUrl: string): string | null {
  const source = resolveSource(getUrl);
  if (source.kind !== "remote") return null;
  const url = new URL(source.url);
  if (!/\/command-floor\/?$/.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/\/command-floor\/?$/, "/simulate-ed-rollup");
  return url.toString();
}
