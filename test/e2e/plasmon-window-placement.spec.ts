import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("packaged native-window defaults remain reachable across repeated close and reopen", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  const windowLayer = app.locator(".plasmon-window-layer").first();
  const workspace = await windowLayer.boundingBox();
  if (!workspace) throw new Error("Plasmon WindowLayer has no browser bounds");

  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
  const baselineCount = await nativeWindows.count();

  const assertReachable = async () => {
    const dialog = nativeWindows.last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error("native window has no bounds");
    expect(bounds.x).toBeGreaterThanOrEqual(workspace.x - 1);
    expect(bounds.y).toBeGreaterThanOrEqual(workspace.y - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(workspace.x + workspace.width + 1);
    expect(bounds.y + Math.min(38, bounds.height)).toBeLessThanOrEqual(workspace.y + workspace.height + 1);
    const close = dialog.locator(".plasmon-window__controls").getByRole("button", { name: "Close" });
    await expect(close).toBeVisible();
    return { dialog, bounds, close };
  };

  await rootShortcut.dblclick();
  await expect(nativeWindows).toHaveCount(baselineCount + 1, { timeout: 20_000 });
  const first = await assertReachable();
  const firstBounds = first.bounds;

  for (let index = 0; index < 60; index += 1) {
    await first.dialog.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
    await expect(nativeWindows).toHaveCount(baselineCount, { timeout: 10_000 });
    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(baselineCount + 1, { timeout: 20_000 });
    await assertReachable();
  }

  const reopenedBounds = await nativeWindows.last().boundingBox();
  if (!reopenedBounds) throw new Error("reopened native window has no bounds");
  expect(reopenedBounds.x).toBeCloseTo(firstBounds.x, 0);
  expect(reopenedBounds.y).toBeCloseTo(firstBounds.y, 0);
  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
