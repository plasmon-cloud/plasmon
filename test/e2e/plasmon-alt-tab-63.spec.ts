import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("#63 packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    await page.locator('[data-tid="launcher-open"]').click();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const frameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(frameSelector).first()).toBeVisible();
    const app = page.frameLocator(frameSelector).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });

    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });
    const first = nativeWindows.last();
    const firstId = await first.getAttribute("data-window-id");
    if (!firstId) throw new Error("first Explorer window has no stable id");

    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 2, { timeout: 20_000 });
    const second = nativeWindows.last();
    const secondId = await second.getAttribute("data-window-id");
    if (!secondId) throw new Error("second Explorer window has no stable id");
    expect(secondId).not.toBe(firstId);

    const firstWindow = app.locator(`.plasmon-window-layer [data-window-id="${firstId}"]`);
    const secondWindow = app.locator(`.plasmon-window-layer [data-window-id="${secondId}"]`);
    await expect(secondWindow).toHaveClass(/plasmon-window--active/);

    // Opening the chooser snapshots canonical Windowing MRU but must not focus
    // the selected member until the Alt modifier is released.
    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    const switcher = app.getByRole("listbox", { name: "Window switcher" });
    await expect(switcher).toBeVisible();
    await expect(switcher.getByRole("option", { selected: true })).toHaveCount(1);
    await expect(switcher.locator("[role='option'][aria-selected='true'] .plasmon-shell__app-icon")).toBeVisible();
    await expect(secondWindow).toHaveClass(/plasmon-window--active/);

    // Repeated Tab cycles only the ephemeral selection. With two members it
    // returns to the focused member while actual focus remains unchanged.
    await page.keyboard.press("Tab");
    await expect(secondWindow).toHaveClass(/plasmon-window--active/);
    await page.keyboard.press("Tab");
    await page.keyboard.up("Alt");
    await expect(switcher).toHaveCount(0);
    await expect(firstWindow).toHaveClass(/plasmon-window--active/);

    // A minimized MRU member remains switchable; WindowManager.focus performs
    // the canonical restore and focus transition on commit.
    await firstWindow.getByRole("button", { name: "Minimize" }).click();
    await expect(firstWindow).toHaveClass(/plasmon-window--minimized/);
    await expect(secondWindow).toHaveClass(/plasmon-window--active/);
    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    await expect(switcher).toBeVisible();
    await page.keyboard.up("Alt");
    await expect(firstWindow).not.toHaveClass(/plasmon-window--minimized/);
    await expect(firstWindow).toHaveClass(/plasmon-window--active/);

    // Escape cancels the held gesture without changing focus; releasing Alt
    // afterwards cannot commit a stale selection.
    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    await expect(switcher).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(switcher).toHaveCount(0);
    await page.keyboard.up("Alt");
    await expect(firstWindow).toHaveClass(/plasmon-window--active/);

    // Closed windows disappear from canonical Windowing MRU. With only one
    // switchable native window left, the Shell must not manufacture a chooser.
    await secondWindow.getByRole("button", { name: "Close" }).click();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 10_000 });
    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    await expect(switcher).toHaveCount(0);
    await page.keyboard.up("Alt");

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
