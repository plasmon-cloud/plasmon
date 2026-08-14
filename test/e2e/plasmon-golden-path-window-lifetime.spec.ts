import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

// Quarantined from required r2 Specialist CI under #251 after Packaged Browser
// run #884 exhausted both attempts while an Explorer sidebar intercepted the
// repeated Root shortcut dblclick. Keep this acceptance executable and in the
// Specialist inventory; --grep-invert @r2-quarantine excludes only this debt.
test(
  "packaged Plasmon repeatedly opens and closes reachable Explorer siblings",
  { tag: ["@r2-quarantine", "@issue-251"] },
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

    const frame = page.locator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
    await expect(frame).toBeVisible();
    const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

    const windowLayer = app.locator(".plasmon-window-layer").first();
    const workspace = await windowLayer.boundingBox();
    if (!workspace) throw new Error("Plasmon WindowLayer has no browser bounds");

    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

    for (let index = 0; index < 60; index += 1) {
      await rootShortcut.dblclick();
      await expect(nativeWindows).toHaveCount(initialWindowCount + 2, { timeout: 20_000 });
      const sibling = nativeWindows.last();
      await expect(sibling).toBeVisible();
      const bounds = await sibling.boundingBox();
      if (!bounds) throw new Error("sibling native window has no bounds");
      expect(bounds.x).toBeGreaterThanOrEqual(workspace.x - 1);
      expect(bounds.y).toBeGreaterThanOrEqual(workspace.y - 1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(workspace.x + workspace.width + 1);
      expect(bounds.y + Math.min(38, bounds.height)).toBeLessThanOrEqual(workspace.y + workspace.height + 1);
      await sibling.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
      await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 10_000 });
    }
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
