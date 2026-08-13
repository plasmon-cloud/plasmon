import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const REVIEW_TILE_ID = "review";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "demo-game";

function expectInsideViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  label: string,
): void {
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
}

test("packaged refactor smoke preserves assembled Plasmon boundaries", async ({ page, request }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "pageerror",
        message: "Canceled",
        reason: "Monaco cancellation token may reject while the real packaged editor initializes or tears down",
      },
    ],
  });

  // Explicit demo configuration lets the same installed Plasmon package expose
  // one redistribution-safe runtime resource without inventing a test-only app.
  const fixtureRoute = `**/app/${PLASMON_APP_ID}/**`;
  const redirectInitialPlasmonDocument = async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const appRoot = `/app/${PLASMON_APP_ID}/`;
    const isMainDocument = route.request().resourceType() === "document"
      && (requestUrl.pathname === appRoot || requestUrl.pathname === `${appRoot}index.html`);
    if (!isMainDocument || requestUrl.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE) {
      await route.continue();
      return;
    }
    requestUrl.searchParams.set(FIXTURE_PARAM, FIXTURE_VALUE);
    await route.fulfill({
      status: 307,
      headers: { location: requestUrl.href, "cache-control": "no-store" },
    });
  };

  try {
    await page.route(fixtureRoute, redirectInitialPlasmonDocument);
    await page.goto(kernelUrl);
    await page.waitForFunction(
      () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
    );
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    const registryResponse = await request.get(new URL("/system/apps.json", kernelUrl).href);
    expect(registryResponse.ok()).toBe(true);
    const registry = await registryResponse.json() as Record<string, {
      version?: number;
      tiles?: Array<{ id?: string; path?: string }>;
    }>;
    expect(registry[PLASMON_APP_ID]?.version).toBe(100);
    expect(registry[PLASMON_APP_ID]?.tiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: PLASMON_TILE_ID, path: "index.html" })]),
    );
    expect(registry[REVIEW_APP_ID]?.tiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: REVIEW_TILE_ID, path: "index.html" })]),
    );

    for (const path of [
      `/app/${PLASMON_APP_ID}/index.html`,
      `/app/${PLASMON_APP_ID}/monaco-workers/editor.worker.js`,
      `/app/${PLASMON_APP_ID}/fixtures/PlasmonDemo.jsdos`,
      `/app/${REVIEW_APP_ID}/index.html`,
    ]) {
      const response = await request.get(new URL(path, kernelUrl).href);
      expect(response.ok(), `${path} should be served from an installed production package`).toBe(true);
    }

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

    const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
    const plasmonFrame = page.locator(plasmonSelector).first();
    await expect(plasmonFrame).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector).first();
    await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    await expect(plasmon.getByRole("button", { name: "Start" })).toBeVisible();
    await expect(plasmon.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(plasmon.getByRole("listbox", { name: "Files" }).first()).toBeVisible();

    const activeUrl = new URL(await plasmon.locator("html").evaluate(() => window.location.href));
    expect(activeUrl.searchParams.get(FIXTURE_PARAM)).toBe(FIXTURE_VALUE);
    await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Packaged smoke requires a fixed Playwright viewport");

    // Search is a projection over native/system authority. Its popup may be
    // redesigned, but it must stay reachable and activate the native owner.
    await plasmon.getByRole("button", { name: "Search" }).click();
    const searchRegion = plasmon.getByRole("region", { name: "Search" });
    await expect(searchRegion).toBeVisible();
    const searchBox = await searchRegion.boundingBox();
    if (!searchBox) throw new Error("Search popup has no browser bounds");
    expectInsideViewport(searchBox, viewport, "Search popup");
    await plasmon.getByLabel("Search Plasmon").fill("Settings");
    const settingsResult = plasmon.locator("[data-search-result]", { hasText: "Settings" }).first();
    await expect(settingsResult).toBeVisible({ timeout: 15_000 });
    await settingsResult.click();

    const settingsWindow = plasmon.getByRole("dialog", { name: "Settings" }).last();
    await expect(settingsWindow).toBeVisible({ timeout: 10_000 });
    const settingsBounds = await settingsWindow.boundingBox();
    const settingsClose = settingsWindow.getByRole("button", { name: "Close" });
    const closeBounds = await settingsClose.boundingBox();
    if (!settingsBounds || !closeBounds) throw new Error("Settings window chrome has no browser bounds");
    expectInsideViewport(settingsBounds, viewport, "Settings window");
    expectInsideViewport(closeBounds, viewport, "Settings close control");

    const settingsTask = plasmon.getByRole("navigation", { name: "Taskbar" })
      .getByRole("button", { name: /^Settings; Active and focused/ });
    await expect(settingsTask).toBeVisible();
    const taskBounds = await settingsTask.boundingBox();
    await settingsTask.click({ button: "right" });
    const taskMenu = plasmon.getByRole("menu", { name: "Shell context menu" });
    await expect(taskMenu).toBeVisible();
    const menuBounds = await taskMenu.boundingBox();
    if (!taskBounds || !menuBounds) throw new Error("Taskbar menu has no browser bounds");
    expectInsideViewport(menuBounds, viewport, "Taskbar menu");
    expect(Math.abs((menuBounds.x + menuBounds.width / 2) - (taskBounds.x + taskBounds.width / 2)))
      .toBeLessThan(300);
    await page.keyboard.press("Escape");
    await settingsClose.click();
    await expect(settingsWindow).not.toBeVisible();

    // Create and open one ordinary document through Desktop/FileManager. The
    // browser assertion protects real Monaco worker startup; association/open
    // semantics remain covered in the deterministic guard.
    const desktopFiles = plasmon.getByRole("listbox", { name: "Files" }).first();
    const desktopBounds = await desktopFiles.boundingBox();
    if (!desktopBounds) throw new Error("Desktop FileManager has no browser bounds");
    await desktopFiles.click({
      button: "right",
      position: {
        x: Math.max(120, Math.floor(desktopBounds.width * 0.55)),
        y: Math.max(120, Math.floor(desktopBounds.height * 0.55)),
      },
    });
    await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
    const rename = plasmon.getByRole("textbox", { name: "Rename New Text Document.txt" });
    await expect(rename).toBeVisible();
    const renameBox = await rename.boundingBox();
    if (!renameBox) throw new Error("Desktop rename editor has no browser bounds");
    expect(renameBox.x).toBeGreaterThanOrEqual(desktopBounds.x - 1);
    expect(renameBox.x + renameBox.width).toBeLessThanOrEqual(desktopBounds.x + desktopBounds.width + 1);
    expect(renameBox.width).toBeLessThanOrEqual(Math.min(desktopBounds.width * 0.6, 520));
    await rename.fill("Refactor Smoke.txt");
    await rename.press("Enter");

    const textEntry = desktopFiles.locator('[data-fm-node-id]').filter({ hasText: "Refactor Smoke.txt" }).first();
    await expect(textEntry).toBeVisible();
    await textEntry.dblclick();
    const editorWindow = plasmon.getByRole("dialog", { name: "Refactor Smoke.txt" }).last();
    await expect(editorWindow).toBeVisible({ timeout: 20_000 });
    await expect(editorWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]'))
      .toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await editorWindow.getByRole("button", { name: "Close" }).click();
    await expect(editorWindow).not.toBeVisible();

    // Review remains independently installed and Kernel-owned. The Plasmon
    // Search surface only reaches it through the canonical projected resource.
    await plasmon.getByRole("button", { name: "Search" }).click();
    await plasmon.getByLabel("Search Plasmon").fill("Review");
    const reviewResult = plasmon.locator("[data-search-result]", { hasText: "Review" }).first();
    await expect(reviewResult).toBeVisible({ timeout: 15_000 });
    await reviewResult.click();
    const reviewSelector = `iframe[data-app-id="${REVIEW_APP_ID}"][data-tile-id="${REVIEW_TILE_ID}"]`;
    await expect(page.locator(reviewSelector).last()).toBeVisible({ timeout: 10_000 });
    await expect(page.frameLocator(reviewSelector).last().locator("#root > .review-app"))
      .toBeVisible({ timeout: 10_000 });

    // One real runtime-handled resource proves the installed package still
    // reaches its generic runtime host without inventing a .sys application.
    const rootShortcut = plasmon.getByRole("option", { name: "Root" });
    await expect(rootShortcut).toBeVisible();
    await rootShortcut.dblclick();
    const rootExplorer = plasmon.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    await rootExplorer.getByRole("option", { name: "Games" }).dblclick();
    const gamesExplorer = plasmon.getByRole("dialog", { name: "Games" }).last();
    await expect(gamesExplorer).toBeVisible({ timeout: 20_000 });
    await gamesExplorer.getByRole("option", { name: "Plasmon Demo.jsdos" }).dblclick();
    const gameWindow = plasmon.getByRole("dialog", { name: "js-dos" }).last();
    await expect(gameWindow).toBeVisible({ timeout: 20_000 });
    const player = gameWindow.getByLabel("DOS game");
    await expect(player).toHaveAttribute("data-jsdos-ready", "true", { timeout: 60_000 });
    await expect(player.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

    health.assertClean();
  } finally {
    await page.unroute(fixtureRoute, redirectInitialPlasmonDocument).catch(() => undefined);
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
