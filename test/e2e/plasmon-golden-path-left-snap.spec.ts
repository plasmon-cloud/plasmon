import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

// Issue #279 restores the isolated #43 left-edge preview/snap acceptance to
// required r2 Specialist CI. The journey stays isolated from the broader golden
// path so earlier desktop interactions cannot contaminate the pointer session.
test(
  "packaged Plasmon previews and commits left snap @issue-279",
  { tag: ["@issue-279"] },
  async ({ page }) => {
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
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appFrameSelector).first()).toBeVisible();
    const app = page.frameLocator(appFrameSelector).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

    const dialog = nativeWindows.last();
    await expect(dialog).toBeVisible();
    const titlebar = dialog.locator(".plasmon-window__titlebar");
    const windowLayer = app.locator(".plasmon-window-layer").first();
    const workspace = await windowLayer.boundingBox();
    if (!workspace) throw new Error("Plasmon WindowLayer has no browser bounds");

    const snapPreview = app.locator(".plasmon-window-layer [data-window-snap-preview]");
    const titlebarBox = await titlebar.boundingBox();
    if (!titlebarBox) throw new Error("Native window titlebar has no browser bounds");
    const offsetX = Math.min(120, titlebarBox.width / 2);
    const offsetY = Math.min(16, titlebarBox.height / 2);
    const dragX = titlebarBox.x + offsetX;
    const dragY = titlebarBox.y + offsetY;

    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await expect(dialog).toHaveAttribute("data-interacting", "drag");
    await page.mouse.move(workspace.x + 1, dragY, { steps: 5 });
    await expect(snapPreview).toHaveAttribute("data-window-snap-preview", "left");

    const geometry = await snapPreview.evaluate((element) => {
      const layer = element.parentElement;
      if (!(layer instanceof HTMLElement)) throw new Error("Snap preview has no WindowLayer parent");
      const previewRect = element.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      return {
        preview: {
          x: previewRect.left - layerRect.left,
          y: previewRect.top - layerRect.top,
          width: previewRect.width,
          height: previewRect.height,
        },
        workspace: {
          width: layer.clientWidth,
          height: layer.clientHeight,
        },
      };
    });
    const dragBounds = await dialog.boundingBox();
    if (!dragBounds) throw new Error("Snap drag window has no browser bounds");

    expect(Math.abs(geometry.preview.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.preview.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.preview.width - Math.floor(geometry.workspace.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.preview.height - geometry.workspace.height)).toBeLessThanOrEqual(1);
    expect(dragBounds.x).toBeGreaterThanOrEqual(workspace.x - 1);
    expect(dragBounds.y).toBeGreaterThanOrEqual(workspace.y - 1);
    expect(dragBounds.x + dragBounds.width).toBeLessThanOrEqual(workspace.x + workspace.width + 1);
    expect(dragBounds.y + dragBounds.height).toBeLessThanOrEqual(workspace.y + workspace.height + 1);

    await page.mouse.up();
    await expect(dialog).not.toHaveAttribute("data-interacting", "drag");
    await expect(snapPreview).toHaveCount(0);
    await expect(dialog).toHaveAttribute("data-window-snap", "left");
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
