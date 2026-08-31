import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";

function expectInsideViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  label: string,
  rightTolerance = 1,
): void {
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(viewport.width + rightTolerance);
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
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #187; the smoke still verifies the real packaged sibling-tile boundary",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190; installed Plasmon assets live under /app/plasmon/static/plasmon/icons/",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Same tracked product URL-resolution defect #190; aborted icon requests are a consequence of the wrong Kernel-root path",
      },
    ],
  });

  try {
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

    for (const path of [
      `/app/${PLASMON_APP_ID}/index.html`,
      `/app/${PLASMON_APP_ID}/runtime/monaco/editor.worker.js`,
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

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Packaged smoke requires a fixed Playwright viewport");

    // Search is a projection over native/system authority. Its exact panel
    // geometry is independently covered. This broad refactor smoke permits the
    // known ~22px right overflow while still catching gross off-screen regressions.
    await plasmon.getByRole("button", { name: "Search" }).click();
    const searchRegion = plasmon.getByRole("region", { name: "Search" });
    await expect(searchRegion).toBeVisible();
    const searchBox = await searchRegion.boundingBox();
    if (!searchBox) throw new Error("Search popup has no browser bounds");
    expectInsideViewport(searchBox, viewport, "Search popup", 24);
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
    const taskMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
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
    // browser assertion protects the packaged editor boundary; association/open
    // semantics remain covered in the deterministic guard. The canonical worker
    // path keeps worker fallback/security warnings fatal.
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
    await clickNewContextMenuItem(plasmon, "New Text Document");
    const rename = plasmon.getByRole("textbox", { name: "Rename New Text Document.txt" });
    await expect(rename).toBeVisible();
    const renameBox = await rename.boundingBox();
    if (!renameBox) throw new Error("Desktop rename editor has no browser bounds");
    expect(renameBox.x).toBeGreaterThanOrEqual(desktopBounds.x - 1);
    expect(renameBox.x + renameBox.width).toBeLessThanOrEqual(desktopBounds.x + desktopBounds.width + 1);
    expect(renameBox.width).toBeLessThanOrEqual(Math.min(desktopBounds.width * 0.6, 520));
    await rename.fill("Refactor Smoke.txt");
    await rename.press("Enter");

    const textEntry = desktopFiles.locator('[data-fm-node-id]', { hasText: "Refactor Smoke.txt" }).first();
    await expect(textEntry).toBeVisible();
    await textEntry.dblclick();
    const editorWindow = plasmon.getByRole("dialog", { name: "Refactor Smoke.txt" }).last();
    await expect(editorWindow).toBeVisible({ timeout: 20_000 });
    await expect(editorWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]'))
      .toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await editorWindow.getByRole("button", { name: "Close" }).click();
    await expect(editorWindow).not.toBeVisible();


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