import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";

async function finishElementAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
}

function expectNear(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1);
}

test("Search keeps stable frame and controls while switching categories", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

  const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
  await expect(page.locator(plasmonSelector).first()).toBeVisible();
  const plasmon = page.frameLocator(plasmonSelector).first();
  const searchButton = plasmon.getByRole("button", { name: "Search" });
  await expect(searchButton).toBeVisible({ timeout: 30_000 });
  await searchButton.click();

  const panel = plasmon.getByRole("region", { name: "Search" });
  const tabs = panel.getByRole("tablist");
  const results = panel.locator(".plasmon-shell__results");
  await expect(panel).toBeVisible();
  await finishElementAnimations(panel);

  const baselinePanel = await panel.boundingBox();
  const baselineTabs = await tabs.boundingBox();
  const baselineResults = await results.boundingBox();
  if (!baselinePanel || !baselineTabs || !baselineResults) {
    throw new Error("Search geometry is unavailable");
  }

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Search geometry test requires a fixed viewport");
  expect(baselinePanel.x).toBeGreaterThanOrEqual(-1);
  expect(baselinePanel.y).toBeGreaterThanOrEqual(-1);
  expect(baselinePanel.x + baselinePanel.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(baselinePanel.y + baselinePanel.height).toBeLessThanOrEqual(viewport.height + 1);

  expect(await panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe("hidden");
  expect(await results.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");

  for (const category of ["Apps", "Documents", "Media", "Atoms"] as const) {
    const tab = panel.getByRole("tab", { name: category, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");

    const currentPanel = await panel.boundingBox();
    const currentTabs = await tabs.boundingBox();
    const currentResults = await results.boundingBox();
    if (!currentPanel || !currentTabs || !currentResults) {
      throw new Error(`Search geometry disappeared after selecting ${category}`);
    }

    expectNear(currentPanel.x, baselinePanel.x, `${category} panel x`);
    expectNear(currentPanel.y, baselinePanel.y, `${category} panel y`);
    expectNear(currentPanel.width, baselinePanel.width, `${category} panel width`);
    expectNear(currentPanel.height, baselinePanel.height, `${category} panel height`);
    expectNear(currentTabs.x, baselineTabs.x, `${category} tabs x`);
    expectNear(currentTabs.y, baselineTabs.y, `${category} tabs y`);
    expectNear(currentTabs.width, baselineTabs.width, `${category} tabs width`);
    expectNear(currentResults.height, baselineResults.height, `${category} results height`);
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
