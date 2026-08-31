import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

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

async function expectSameBounds(locator: Locator, baseline: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>, label: string): Promise<void> {
  const current = await locator.boundingBox();
  if (!current) throw new Error(`${label} geometry is unavailable`);
  expectNear(current.x, baseline.x, `${label} x`);
  expectNear(current.y, baseline.y, `${label} y`);
  expectNear(current.width, baseline.width, `${label} width`);
  expectNear(current.height, baseline.height, `${label} height`);
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

test("Start and Search overlays do not move Desktop resources or normal/maximized native windows", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside this Shell overlay geometry gate",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked icon URL-resolution behavior is outside Shell overlay geometry",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked icon URL-resolution behavior is outside Shell overlay geometry",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

    const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
    await expect(page.locator(plasmonSelector).first()).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector).first();
    await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

    const files = plasmon.getByRole("listbox", { name: "Files" }).first();
    await expect(files).toBeVisible({ timeout: 30_000 });
    const desktopResource = files.locator(".fm-entries [data-fm-node-id]").first();
    await expect(desktopResource).toBeVisible();

    const nativeWindows = plasmon.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    await plasmon.getByRole("button", { name: "Start", exact: true }).click();
    const setupStart = plasmon.getByRole("region", { name: "Start menu" });
    await expect(setupStart).toBeVisible();
    await setupStart.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });
    const nativeWindow = nativeWindows.last();
    await expect(nativeWindow).toBeVisible();

    const desktopBaseline = await desktopResource.boundingBox();
    const normalWindowBaseline = await nativeWindow.boundingBox();
    if (!desktopBaseline || !normalWindowBaseline) {
      throw new Error("Desktop/native-window baseline geometry is unavailable");
    }

    const exerciseFlyouts = async (
      windowState: "normal" | "maximized",
      windowBaseline: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>,
    ): Promise<void> => {
      const startButton = plasmon.getByRole("button", { name: "Start", exact: true });
      await startButton.click();
      const startPanel = plasmon.getByRole("region", { name: "Start menu" });
      await expect(startPanel).toBeVisible();
      await expectSameBounds(desktopResource, desktopBaseline, `Desktop resource while Start opens with ${windowState} window`);
      await expectSameBounds(nativeWindow, windowBaseline, `${windowState} native window while Start opens`);
      await startPanel.getByRole("textbox", { name: "Search Start" }).press("Escape");
      await expect(startPanel).toHaveCount(0);
      await expectSameBounds(desktopResource, desktopBaseline, `Desktop resource after Start closes with ${windowState} window`);
      await expectSameBounds(nativeWindow, windowBaseline, `${windowState} native window after Start closes`);

      const searchButton = plasmon.getByRole("button", { name: "Search" });
      await searchButton.click();
      const searchPanel = plasmon.getByRole("region", { name: "Search" });
      await expect(searchPanel).toBeVisible();
      await expectSameBounds(desktopResource, desktopBaseline, `Desktop resource while Search opens with ${windowState} window`);
      await expectSameBounds(nativeWindow, windowBaseline, `${windowState} native window while Search opens`);
      await searchPanel.getByRole("textbox", { name: "Search Plasmon" }).press("Escape");
      await expect(searchPanel).toHaveCount(0);
      await expectSameBounds(desktopResource, desktopBaseline, `Desktop resource after Search closes with ${windowState} window`);
      await expectSameBounds(nativeWindow, windowBaseline, `${windowState} native window after Search closes`);
    };

    await exerciseFlyouts("normal", normalWindowBaseline);

    await nativeWindow.getByRole("button", { name: "Maximize" }).click();
    await expect(nativeWindow.getByRole("button", { name: "Restore" })).toBeVisible();
    await finishElementAnimations(nativeWindow);
    const maximizedWindowBaseline = await nativeWindow.boundingBox();
    if (!maximizedWindowBaseline) throw new Error("Maximized native-window geometry is unavailable");
    await exerciseFlyouts("maximized", maximizedWindowBaseline);

    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
