import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const PHOTO_NAME = "photos-workspace-expand.png";
const PHOTO_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  "base64",
);

test("Photos expands through Windowing when Neutron denies browser fullscreen and restores prior geometry", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appFrameSelector).first()).toBeVisible();
  const app = page.frameLocator(appFrameSelector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  const fullscreenEnabled = await app.locator("html").evaluate(() => document.fullscreenEnabled);
  expect(fullscreenEnabled, "Neutron's installed Plasmon frame should deny browser fullscreen").toBe(false);

  const files = app.getByRole("listbox", { name: "Files" }).first();
  await expect(files).toBeVisible({ timeout: 30_000 });
  await files.locator('input[type="file"]').setInputFiles({
    name: PHOTO_NAME,
    mimeType: "image/png",
    buffer: PHOTO_BYTES,
  });

  const photoEntry = app.locator("[data-fm-node-id]", { hasText: PHOTO_NAME }).first();
  await expect(photoEntry).toBeVisible({ timeout: 30_000 });
  const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
  const initialWindowCount = await nativeWindows.count();
  await photoEntry.dblclick();
  await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

  const photoWindow = nativeWindows.last();
  const photos = photoWindow.getByRole("region", { name: "Photos" });
  await expect(photos).toBeVisible({ timeout: 20_000 });
  await expect(photos.getByRole("img", { name: PHOTO_NAME })).toBeVisible({ timeout: 20_000 });
  const expand = photos.getByRole("button", { name: "Expand" });
  await expect(expand).toBeEnabled();

  const windowLayer = app.locator(".plasmon-window-layer").first();
  const before = await photoWindow.boundingBox();
  const workspace = await windowLayer.boundingBox();
  if (!before || !workspace) throw new Error("Photos or WindowLayer has no browser geometry");

  await expand.click();
  await expect(photos).toHaveAttribute("data-photos-display-mode", "expanded");
  await expect(photoWindow).toHaveClass(/plasmon-window--maximized/);
  await expect(photos.getByRole("button", { name: "Exit expanded" })).toBeVisible();
  await expect(photos.getByRole("status")).toContainText("Browser fullscreen is unavailable");

  const expanded = await photoWindow.boundingBox();
  if (!expanded) throw new Error("Expanded Photos window has no browser geometry");
  expect(Math.abs(expanded.x - workspace.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(expanded.y - workspace.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(expanded.width - workspace.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(expanded.height - workspace.height)).toBeLessThanOrEqual(1);

  await photos.getByRole("button", { name: "Exit expanded" }).click();
  await expect(photos).toHaveAttribute("data-photos-display-mode", "normal");
  await expect(photoWindow).not.toHaveClass(/plasmon-window--maximized/);

  const restored = await photoWindow.boundingBox();
  if (!restored) throw new Error("Restored Photos window has no browser geometry");
  expect(Math.abs(restored.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(restored.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(restored.width - before.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(restored.height - before.height)).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
