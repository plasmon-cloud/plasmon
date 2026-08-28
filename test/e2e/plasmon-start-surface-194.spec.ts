import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

async function finishAnimations(target: Locator): Promise<void> {
  await target.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

/**
 * #194 already has deterministic Start reconciliation/state coverage and bounded
 * RTL interaction coverage. #573 restores the same stable re-open geometry
 * contract during filesystem-backed Start revalidation. This packaged browser
 * acceptance proves stable panel geometry, real focus, keyboard
 * dismissal/opening, and pointer click-away dismissal.
 */
test("#194 #573 — packaged Start preserves panel geometry, focus, and dismissal", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #194; this gate still exercises the real packaged Start adapter",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #194 Start geometry/focus/dismissal",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #194 Start geometry/focus/dismissal",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const plasmonSelector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(plasmonSelector)).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector);
    const shell = plasmon.locator(".plasmon-shell").first();
    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
    const start = plasmon.getByRole("button", { name: "Start", exact: true });
    const panel = plasmon.getByRole("region", { name: "Start menu" });
    const search = plasmon.getByRole("textbox", { name: "Search Start" });

    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(taskbar).toBeVisible();
    await expect(start).toBeVisible();

    await start.click();
    await expect(panel).toBeVisible();
    await expect(search).toBeFocused();
    await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });
    await finishAnimations(panel);

    const shellBox = await shell.boundingBox();
    const taskbarBox = await taskbar.boundingBox();
    const firstPanelBox = await panel.boundingBox();
    if (!shellBox || !taskbarBox || !firstPanelBox) {
      throw new Error("Packaged Start has no browser geometry");
    }

    const expectedWidth = Math.min(680, shellBox.width - 24);
    expect(Math.abs(firstPanelBox.width - expectedWidth), "Start uses its responsive 680px/24px-inset width")
      .toBeLessThanOrEqual(1.5);
    expect(
      Math.abs((firstPanelBox.x + firstPanelBox.width / 2) - (shellBox.x + shellBox.width / 2)),
      "Start remains horizontally centered in the Shell",
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(taskbarBox.y - (firstPanelBox.y + firstPanelBox.height) - 10),
      "Start remains 10px above the taskbar",
    ).toBeLessThanOrEqual(1.5);
    expect(firstPanelBox.x, "Start keeps the responsive left inset").toBeGreaterThanOrEqual(shellBox.x + 11);
    expect(firstPanelBox.x + firstPanelBox.width, "Start keeps the responsive right inset")
      .toBeLessThanOrEqual(shellBox.x + shellBox.width - 11);

    // Escape is a real Shell/window keyboard boundary, not a StartSurface-local fake.
    await search.press("Escape");
    await expect(panel).toHaveCount(0);

    // Ctrl+Escape reopens Start through the Shell global keyboard adapter and
    // autofocus returns to the real browser input.
    await start.focus();
    await start.press("Control+Escape");
    await expect(panel).toBeVisible();
    await expect(search).toBeFocused();
    await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });
    await finishAnimations(panel);

    const secondPanelBox = await panel.boundingBox();
    if (!secondPanelBox) throw new Error("Reopened packaged Start has no browser geometry");
    expect(Math.abs(secondPanelBox.x - firstPanelBox.x), "reopen preserves Start x").toBeLessThanOrEqual(1);
    expect(Math.abs(secondPanelBox.y - firstPanelBox.y), "reopen preserves Start y").toBeLessThanOrEqual(1);
    expect(Math.abs(secondPanelBox.width - firstPanelBox.width), "reopen preserves Start width").toBeLessThanOrEqual(1);
    expect(Math.abs(secondPanelBox.height - firstPanelBox.height), "reopen preserves Start height").toBeLessThanOrEqual(1);

    // A pointer outside the flyout/toggle reaches the real document capture
    // listener and dismisses Start without a test-only close hook.
    const workspace = plasmon.locator(".plasmon-shell__workspace").first();
    const workspaceBox = await workspace.boundingBox();
    if (!workspaceBox) throw new Error("Packaged Shell workspace has no browser geometry");
    await workspace.click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);

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
