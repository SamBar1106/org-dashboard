import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const shots = "/opt/cursor/artifacts/screenshots";
mkdirSync(shots, { recursive: true });

interface Seed {
  project_pads: { level: string; open_pr_count: number | null }[];
  database_racks: { level: string }[];
  agents: { state: string }[];
}

function countsOf(seed: Seed) {
  const red =
    seed.project_pads.filter((pad) => pad.level === "CRITICAL").length +
    seed.database_racks.filter((rack) => rack.level === "CRITICAL").length +
    seed.agents.filter((agent) => agent.state === "red_alert").length;
  const waiting = seed.agents.filter((agent) => agent.state === "waiting_samuel").length;
  const prs = seed.project_pads.reduce((sum, pad) => sum + (pad.open_pr_count ?? 0), 0);
  return {
    red,
    waiting,
    prs,
    total: seed.project_pads.length + seed.database_racks.length + seed.agents.length,
  };
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const view = root.clientWidth;
    const outside: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest(".canvas-wrap") || el.closest(".sr-only") || el.closest("[hidden]")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.left < -1 || rect.right > view + 1) {
        outside.push(`${el.tagName}.${String(el.className)}`.slice(0, 80));
      }
    }
    return { delta: root.scrollWidth - view, outside: outside.slice(0, 8) };
  });
  expect(overflow.delta, JSON.stringify(overflow.outside)).toBeLessThanOrEqual(1);
  expect(overflow.outside, "elements wider than the viewport").toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Virtual Command Floor");
  await expect(page.getByTestId("inspector-title")).toHaveText("Sam ERP App");
  await expect(page.getByTestId("viewport")).toHaveAttribute("data-framed", "true");
});

test("counts come from the seed and the bundle does not call loopback", async ({ page }) => {
  const seed = (await (await page.request.get("/org-dashboard/data/command-floor.json")).json()) as Seed;
  const counts = countsOf(seed);
  await expect(page.getByTestId("pill-red")).toHaveText(`${counts.red} Red Alerts`);
  await expect(page.getByTestId("pill-waiting")).toHaveText(`${counts.waiting} Waiting on Samuel`);
  await expect(page.getByTestId("pill-prs")).toHaveText(`${counts.prs} Open PRs`);
  await expect(page.getByTestId("filter-all")).toHaveText(`All Ecosystem (${counts.total})`);

  const src = await page.locator("script[type=module]").getAttribute("src");
  expect(src).toBeTruthy();
  const js = await (await page.request.get(src ?? "")).text();
  expect(js).not.toMatch(/https?:\/\/127\.0\.0\.1/);
  expect(js).not.toMatch(/https?:\/\/localhost/);
});

test("each filter dims some objects and a pad click updates the inspector", async ({ page }) => {
  async function opacities() {
    return page.locator("[data-testid=opacity-map] [data-opacity]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-opacity")),
    );
  }

  const all = await opacities();
  expect(all.every((value) => value === "1")).toBe(true);

  for (const filter of ["red", "waiting", "prs"]) {
    await page.getByTestId(`filter-${filter}`).click();
    await expect(page.getByTestId(`filter-${filter}`)).toHaveAttribute("aria-pressed", "true");
    const values = await opacities();
    expect(values, filter).toContain("1");
    expect(values, filter).toContain("0.2");
  }

  await page.getByTestId("pad-label-loom").click();
  await expect(page.getByTestId("inspector-title")).toHaveText("Loom (store builder)");
  await expect(page.locator(".meta")).toContainText("4");
  await expect(page.locator(".meta")).toContainText("En progreso");
  await expect(page.locator(".meta")).toContainText("Level:");

  await page.getByTestId("rack-label-odoo").evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByTestId("inspector-title")).toHaveText("Odoo");

  await page.locator("nav.sr-only button", { hasText: "Web Dev" }).evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByTestId("inspector-title")).toHaveText("Web Dev");

  await page.getByTestId("rollup").click();
  await expect(page.getByTestId("viewport")).toHaveClass(/is-rolling/);
  await expect(page.getByTestId("rollup-note")).toHaveText(/Seed refreshed/);
});

test("no horizontal scroll at iPad portrait, iPad landscape, and 1280", async ({ page }) => {
  const viewports = [
    { name: "ipad-portrait", width: 1024, height: 1366 },
    { name: "ipad-landscape", width: 1366, height: 1024 },
    { name: "desktop-1280", width: 1280, height: 800 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(250);
    await expect(page.getByTestId("edit-floor")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${shots}/command-floor-${viewport.name}.png` });
  }

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(page.getByTestId("nav-menu")).toBeVisible();
  await page.getByTestId("nav-menu").click();
  await expect(page.getByTestId("nav-approvals")).toBeVisible();
  await page.screenshot({ path: `${shots}/command-floor-ipad-drawer.png` });
  await page.getByLabel("Close menu").click();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId("nav-menu")).toHaveCount(0);
  await expect(page.getByTestId("nav-home")).toBeVisible();
  await page.getByTestId("edit-floor").click();
  await expect(page.getByTestId("edit-panel")).toBeVisible();
  await page.getByTestId("edit-panel").scrollIntoViewIfNeeded();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${shots}/command-floor-desktop-edit.png` });

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(page.getByTestId("edit-panel")).toBeVisible();
  await expect(page.getByTestId("edit-floor")).toBeVisible();
  await page.getByTestId("edit-panel").scrollIntoViewIfNeeded();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${shots}/command-floor-ipad-edit.png` });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("filter-red").click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${shots}/command-floor-desktop-red-filter.png` });
});

test("header badges filter, legend arcs toggle, and red labels stop shaking after a click", async ({ page }) => {
  await page.getByTestId("pill-red").click();
  await expect(page.getByTestId("filter-red")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pad-label-mge-triage-hub")).toHaveAttribute("data-alert", "true");
  await page.getByTestId("pad-label-mge-triage-hub").click();
  await expect(page.getByTestId("pad-label-mge-triage-hub")).toHaveAttribute("data-alert", "false");
  await expect(page.getByTestId("inspector-title")).toHaveText("MGE Triage Hub");

  await page.getByTestId("filter-all").click();
  await page.getByTestId("legend-odoo").click();
  await expect(page.locator("[data-testid=opacity-map] [data-id='odoo::sam-erp']")).toHaveAttribute("data-opacity", "0");
  await page.getByTestId("legend-odoo").click();
  await expect(page.locator("[data-testid=opacity-map] [data-id='odoo::sam-erp']")).toHaveAttribute("data-opacity", "1");
});

test("public build keeps private actions locked and sound off", async ({ page }) => {
  const seed = (await (await page.request.get("/org-dashboard/data/command-floor.json")).json()) as Seed;
  const counts = countsOf(seed);
  const activePads = seed.project_pads.filter((pad) => pad.level !== "IDLE").length;
  await expect(page.getByTestId("deck-chip")).toHaveText(`COMMAND DECK • ${activePads} Active Pads • ${seed.database_racks.length} Data Hubs`);
  await expect(page.getByTestId("brand")).toContainText("Orchestrator");
  await expect(page.getByTestId("brand")).toContainText("Division 4");
  await expect(page.getByTestId("nav-badge-approvals")).toHaveText(String(counts.waiting));
  await expect(page.getByTestId("lane-status")).toContainText("Lanes Active");
  await expect(page.getByTestId("avatar")).toHaveText("S");
  await expect(page.getByTestId("samuel-ai")).toHaveText("Samuel + AI");
  await expect(page.getByTestId("open-repo")).toHaveAttribute("href", /^https:\/\//);
  await expect(page.getByTestId("mark-resolved")).toBeDisabled();
  await expect(page.getByTestId("dispatch-agent")).toBeDisabled();
  await expect(page.getByTestId("approve-run")).toBeDisabled();
  await expect(page.getByTestId("private-note")).toHaveText("needs private backend");
  await expect(page.getByTestId("mode-live")).toBeDisabled();
  await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("edit-floor")).toBeVisible();

  await page.getByTestId("live-ping").click();
  await expect(page.getByTestId("rollup-note")).toContainText("Live ping");
});

test("edit floor adds a desk from the data already on screen", async ({ page }) => {
  await page.getByTestId("edit-floor").click();
  await expect(page.getByTestId("edit-panel")).toBeVisible();
  await page.getByTestId("desk-name").fill("Relay Desk");
  await page.getByTestId("add-desk").click();
  await expect(page.getByTestId("filter-all")).toHaveText(/All Ecosystem \(29\)/);
  await expect(page.getByTestId("pad-label-relay-desk")).toBeVisible();
});

test("the live org page still renders", async ({ page }) => {
  await page.goto("/org-dashboard/live.html");
  await expect(page.locator("h1")).toHaveText(/Division One/);
  await expect(page.locator("#floor .room").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Command floor" })).toBeVisible();
});
