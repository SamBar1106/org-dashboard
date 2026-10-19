import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4174/org-dashboard/",
    hasTouch: true,
    viewport: { width: 1280, height: 800 },
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: "node scripts/pages-server.mjs",
    port: 4174,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
