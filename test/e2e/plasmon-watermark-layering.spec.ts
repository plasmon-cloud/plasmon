import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("watermark stays in wallpaper composition below Desktop and native-window content", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside this Shell watermark layering gate",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked icon URL-resolution behavior is outside Shell watermark layering",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked icon URL-resolution behavior is outside Shell watermark layering",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector).first()).toBeVisible();
    const app = page.frameLocator(appSelector).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

    const shell = app.locator(".plasmon-shell");
    const wallpaper = app.locator(".plasmon-shell__wallpaper");
    const rootShortcut = app.getByRole("region", { name: "Desktop" }).locator("[data-fm-node-id]", { hasText: "Root" });
    await expect(shell).toHaveAttribute("data-plasmon-brand-watermark", "visible");
    await expect(wallpaper).toBeVisible();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });

    const composition = await wallpaper.evaluate((element) => {
      const pseudo = getComputedStyle(element, "::after");
      return {
        backgroundImage: pseudo.backgroundImage,
        height: Number.parseFloat(pseudo.height),
        pointerEvents: pseudo.pointerEvents,
        width: Number.parseFloat(pseudo.width),
        zIndex: pseudo.zIndex,
        parentZIndex: getComputedStyle(element).zIndex,
        workspaceFollows: element.nextElementSibling?.classList.contains("plasmon-shell__workspace") === true,
      };
    });
    expect(composition.backgroundImage).toContain("plasmon-watermark.svg");
    expect(composition.height).toBeGreaterThan(42);
    expect(composition.width).toBeGreaterThan(176);
    expect(composition.pointerEvents).toBe("none");
    expect(composition.zIndex).toBe("auto");
    expect(composition.parentZIndex).toBe("auto");
    expect(composition.workspaceFollows).toBe(true);

    const rootHit = await rootShortcut.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || (hit instanceof Node && element.contains(hit));
    });
    expect(rootHit).toBe(true);

    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });
    const nativeWindow = nativeWindows.last();
    await expect(nativeWindow).toBeVisible();
    const windowId = await nativeWindow.getAttribute("data-window-id");
    if (!windowId) throw new Error("Native window identity is unavailable");

    await nativeWindow.getByRole("button", { name: "Maximize" }).click();
    await expect(nativeWindow.getByRole("button", { name: "Restore" })).toBeVisible();

    const overlap = await wallpaper.evaluate((element, targetWindowId) => {
      const pseudo = getComputedStyle(element, "::after");
      const wallpaperRect = element.getBoundingClientRect();
      const width = Number.parseFloat(pseudo.width);
      const height = Number.parseFloat(pseudo.height);
      const right = Number.parseFloat(pseudo.right);
      const bottom = Number.parseFloat(pseudo.bottom);
      const x = wallpaperRect.right - right - width / 2;
      const y = wallpaperRect.bottom - bottom - height / 2;
      const targetWindow = Array.from(document.querySelectorAll<HTMLElement>("[data-window-id]"))
        .find((candidate) => candidate.dataset.windowId === targetWindowId);
      if (!targetWindow) throw new Error("Target native window is unavailable");
      const targetRect = targetWindow.getBoundingClientRect();
      const hit = document.elementFromPoint(x, y);
      return {
        pointInsideWindow:
          x >= targetRect.left && x <= targetRect.right &&
          y >= targetRect.top && y <= targetRect.bottom,
        hitWindowId: hit?.closest<HTMLElement>("[data-window-id]")?.dataset.windowId ?? null,
      };
    }, windowId);
    expect(overlap.pointInsideWindow).toBe(true);
    expect(overlap.hitWindowId).toBe(windowId);

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
