const SENSITIVE: { name: string; re: RegExp }[] = [
  { name: "ipv4", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { name: "ipv6", re: /\b(?:[0-9a-f]{0,4}:){2,}[0-9a-f]{0,4}\b/i },
  { name: "email", re: /[^\s@]+@[^\s@]+\.[^\s@]+/ },
  { name: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "loopback", re: /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i },
  { name: "tailnet", re: /\.ts\.net\b|tailscale\.[a-z]/i },
  { name: "token", re: /\b(?:ghp_|github_pat_|sk-|xox[baprs]-|AKIA)[A-Za-z0-9_-]{8,}/ },
  { name: "path", re: /[A-Za-z]:\\|\/Users\/|\/home\/|\\\\/ },
  { name: "phone", re: /\b\+?\d[\d\s().-]{8,}\d\b/ },
  { name: "long-number", re: /\b\d{9,}\b/ },
];

export function sensitiveKind(value: string): string | null {
  for (const entry of SENSITIVE) {
    if (entry.re.test(value)) return entry.name;
  }
  return null;
}

export function redactPublic(value: string): string {
  return sensitiveKind(value) ? "hidden" : value;
}
