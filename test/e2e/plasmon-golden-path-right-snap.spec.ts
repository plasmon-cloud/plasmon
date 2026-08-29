import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

// Issue #244 restores this real-browser snapped -> restore -> opposite-edge
// contract to required serialized Specialist execution. Synchronize on the
// production drag-session state before moving the top-level Playwright pointer
// to an iframe edge; do not use sleeps, retries, or WindowManager test hooks.
test(
  "packaged Plasmon restores a left-snapped native window and previews right snap",
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
    const snapPreviewGeometry = async () => snapPreview.evaluate((element) => {
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

    const beginTitlebarDrag = async (): Promise<{ x: number; y: number; offsetX: number; offsetY: number }> => {
      const box = await titlebar.boundingBox();
      if (!box) throw new Error("Native window titlebar has no browser bounds");
      const offsetX = Math.min(120, box.width / 2);
      const offsetY = Math.min(16, box.height / 2);
      const x = box.x + offsetX;
      const y = box.y + offsetY;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await expect(dialog).toHaveAttribute("data-interacting", "drag");
      return { x, y, offsetX, offsetY };
    };

    const leftDrag = await beginTitlebarDrag();
    await page.mouse.move(workspace.x + 1, leftDrag.y, { steps: 5 });
    await expect(snapPreview).toHaveAttribute("data-window-snap-preview", "left");
    await page.mouse.up();
    await expect(dialog).not.toHaveAttribute("data-interacting", "drag");
    await expect(snapPreview).toHaveCount(0);
    await expect(dialog).toHaveAttribute("data-window-snap", "left");

    const rightDrag = await beginTitlebarDrag();
    await expect(dialog).not.toHaveAttribute("data-window-snap", "left");
    const restoredTitlebarBounds = await titlebar.boundingBox();
    if (!restoredTitlebarBounds) throw new Error("Restored native titlebar has no browser bounds");
    expect(Math.abs((rightDrag.x - restoredTitlebarBounds.x) - rightDrag.offsetX)).toBeLessThanOrEqual(2);
    expect(Math.abs((rightDrag.y - restoredTitlebarBounds.y) - rightDrag.offsetY)).toBeLessThanOrEqual(2);
    expect(rightDrag.x).toBeGreaterThanOrEqual(restoredTitlebarBounds.x - 1);
    expect(rightDrag.x).toBeLessThanOrEqual(restoredTitlebarBounds.x + restoredTitlebarBounds.width + 1);

    await page.mouse.move(workspace.x + workspace.width - 1, rightDrag.y, { steps: 5 });
    await expect(snapPreview).toHaveAttribute("data-window-snap-preview", "right");
    const rightPreviewGeometry = await snapPreviewGeometry();
    const rightDragBounds = await dialog.boundingBox();
    if (!rightDragBounds) throw new Error("Right snap drag window has no browser bounds");
    expect(Math.abs((rightPreviewGeometry.preview.x + rightPreviewGeometry.preview.width) - rightPreviewGeometry.workspace.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(rightPreviewGeometry.preview.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(rightPreviewGeometry.preview.height - rightPreviewGeometry.workspace.height)).toBeLessThanOrEqual(1);
    expect(rightDragBounds.x).toBeGreaterThanOrEqual(workspace.x - 1);
    expect(rightDragBounds.y).toBeGreaterThanOrEqual(workspace.y - 1);
    expect(rightDragBounds.x + rightDragBounds.width).toBeLessThanOrEqual(workspace.x + workspace.width + 1);
    expect(rightDragBounds.y + rightDragBounds.height).toBeLessThanOrEqual(workspace.y + workspace.height + 1);
    await page.mouse.up();
    await expect(dialog).not.toHaveAttribute("data-interacting", "drag");
    await expect(snapPreview).toHaveCount(0);
    await expect(dialog).toHaveAttribute("data-window-snap", "right");
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
