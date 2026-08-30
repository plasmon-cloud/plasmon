import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";

test.describe.configure({ retries: 0 });

test("taskbar context menus stay source-adjacent and expose canonical Close and alignment", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

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

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

    const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
    const plasmonFrame = page.locator(plasmonSelector).first();
    await expect(plasmonFrame).toBeVisible();
    const plasmonFrameBounds = await plasmonFrame.boundingBox();
    if (!plasmonFrameBounds) throw new Error("Plasmon app frame has no browser bounds");

    const plasmon = page.frameLocator(plasmonSelector).first();
    const shell = plasmon.locator(".plasmon-shell");
    await expect(shell).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible();

    const rootShortcut = plasmon.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    const nativeWindows = plasmon.locator(".plasmon-window-layer [data-window-id]");
    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(1, { timeout: 20_000 });

    const filesTask = taskbar.getByRole("button", { name: /^File Explorer;/ }).first();
    await expect(filesTask).toBeVisible();
    const filesTaskBounds = await filesTask.boundingBox();
    if (!filesTaskBounds) throw new Error("File Explorer taskbar item has no browser bounds");

    await filesTask.click({ button: "right" });
    const itemMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
    await expect(itemMenu).toBeVisible();
    await expect(itemMenu.getByRole("menuitem", { name: /Pin to taskbar|Unpin from taskbar/ })).toBeVisible();
    await expect(itemMenu.getByRole("menuitem", { name: "Close" })).toBeVisible();
    await itemMenu.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });

    const itemMenuBounds = await itemMenu.boundingBox();
    if (!itemMenuBounds) throw new Error("Taskbar item context menu has no browser bounds");
    const itemGap = filesTaskBounds.y - (itemMenuBounds.y + itemMenuBounds.height);
    expect(itemGap).toBeGreaterThanOrEqual(4);
    expect(itemGap).toBeLessThanOrEqual(10);
    expect(Math.abs(
      (itemMenuBounds.x + itemMenuBounds.width / 2)
        - (filesTaskBounds.x + filesTaskBounds.width / 2),
    )).toBeLessThanOrEqual(3);
    expect(itemMenuBounds.x).toBeGreaterThanOrEqual(plasmonFrameBounds.x + 7);
    expect(itemMenuBounds.x + itemMenuBounds.width).toBeLessThanOrEqual(
      plasmonFrameBounds.x + plasmonFrameBounds.width - 7,
    );
    expect(itemMenuBounds.y).toBeGreaterThanOrEqual(plasmonFrameBounds.y + 7);

    // Close remains an ordinary Process lifecycle request. This native File Explorer
    // process has no dirty-veto path, so the rendered window should disappear.
    await itemMenu.getByRole("menuitem", { name: "Close" }).click();
    await expect(nativeWindows).toHaveCount(0, { timeout: 10_000 });

    const taskbarBounds = await taskbar.boundingBox();
    if (!taskbarBounds) throw new Error("Taskbar has no browser bounds");

    // Invoke the background at the extreme left to exercise viewport clamping.
    await taskbar.click({
      button: "right",
      position: { x: 2, y: Math.max(2, taskbarBounds.height / 2) },
    });
    const backgroundMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
    await expect(backgroundMenu).toBeVisible();
    const backgroundMenuBounds = await backgroundMenu.boundingBox();
    if (!backgroundMenuBounds) throw new Error("Taskbar background context menu has no browser bounds");
    expect(backgroundMenuBounds.x).toBeGreaterThanOrEqual(plasmonFrameBounds.x + 7);
    expect(backgroundMenuBounds.x).toBeLessThanOrEqual(plasmonFrameBounds.x + 10);
    expect(backgroundMenuBounds.x + backgroundMenuBounds.width).toBeLessThanOrEqual(
      plasmonFrameBounds.x + plasmonFrameBounds.width - 7,
    );
    expect(backgroundMenuBounds.y).toBeGreaterThanOrEqual(plasmonFrameBounds.y + 7);
    expect(backgroundMenuBounds.y + backgroundMenuBounds.height).toBeLessThanOrEqual(
      plasmonFrameBounds.y + plasmonFrameBounds.height - 7,
    );

    const taskbarMain = plasmon.locator("[data-shell-taskbar-main]");
    const taskbarStatus = plasmon.locator("[data-shell-taskbar-status]");
    await backgroundMenu.getByRole("menuitemradio", { name: "Left-align taskbar icons" }).click();
    await expect(taskbar).toHaveAttribute("data-taskbar-alignment", "left");

    const leftMainBounds = await taskbarMain.boundingBox();
    const statusBounds = await taskbarStatus.boundingBox();
    if (!leftMainBounds || !statusBounds) throw new Error("Taskbar alignment surfaces have no browser bounds");
    expect(leftMainBounds.x - taskbarBounds.x).toBeGreaterThanOrEqual(8);
    expect(leftMainBounds.x - taskbarBounds.x).toBeLessThanOrEqual(12);
    expect(taskbarBounds.x + taskbarBounds.width - (statusBounds.x + statusBounds.width)).toBeLessThanOrEqual(12);

    // With application buttons left-aligned, the center is blank taskbar
    // background and can restore the accepted Center preference.
    await taskbar.click({
      button: "right",
      position: { x: taskbarBounds.width / 2, y: Math.max(2, taskbarBounds.height / 2) },
    });
    const centeredMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
    await expect(centeredMenu).toBeVisible();
    await centeredMenu.getByRole("menuitemradio", { name: "Center taskbar icons" }).click();
    await expect(taskbar).toHaveAttribute("data-taskbar-alignment", "center");

    const centeredMainBounds = await taskbarMain.boundingBox();
    if (!centeredMainBounds) throw new Error("Centered taskbar application surface has no browser bounds");
    expect(Math.abs(
      (centeredMainBounds.x + centeredMainBounds.width / 2)
        - (taskbarBounds.x + taskbarBounds.width / 2),
    )).toBeLessThanOrEqual(2);

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
