import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function openInstalledPlasmon(page: import("@playwright/test").Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
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
  const frameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(frameSelector).first()).toBeVisible();
  const app = page.frameLocator(frameSelector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { app, kernelUrl };
}

function desktopRootShortcut(app: import("@playwright/test").FrameLocator) {
  return app.getByRole("region", { name: "Desktop" }).locator("[data-fm-node-id]", { hasText: "Root" });
}

async function selectDesktopRoot(app: import("@playwright/test").FrameLocator) {
  const rootShortcut = desktopRootShortcut(app);
  await expect(rootShortcut).toHaveCount(1);
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.click();
  await expect(rootShortcut).toHaveAttribute("aria-selected", "true");
}

async function activateSelectedDesktopRoot(
  app: import("@playwright/test").FrameLocator,
  nativeWindows: import("@playwright/test").Locator,
  expectedWindowCount: number,
) {
  const desktop = app.getByRole("region", { name: "Desktop" });
  const files = desktop.getByRole("listbox", { name: "Files" });
  const rootShortcut = desktopRootShortcut(app);

  // Root is selected once before any Explorer can cover the Desktop. Reuse the
  // production FileManager keyboard boundary for every sibling launch instead
  // of trying to pointer-activate an entry that an existing Explorer may cover.
  await expect(rootShortcut).toHaveAttribute("aria-selected", "true");
  await files.press("Enter");

  // WindowManager projection can precede completion of the async native-app
  // launch path. Treat the new Explorer as ready only after its real FileManager
  // surface has mounted and loaded the requested Root directory.
  await expect(nativeWindows).toHaveCount(expectedWindowCount, { timeout: 20_000 });
  await expect(nativeWindows.last().getByRole("textbox", { name: "Address" })).toHaveValue("/", {
    timeout: 20_000,
  });
}

// The two acceptances below independently cover sibling-window lifetime and
// Alt-Tab restoration. They reproduced the same pre-semantics second-Explorer
// setup failure while retaining separate behavioral evidence.
test(
  "packaged Plasmon repeatedly opens and closes reachable Explorer siblings",
  async ({ page }) => {
    const { app } = await openInstalledPlasmon(page);
    const windowLayer = app.locator(".plasmon-window-layer").first();
    const workspace = await windowLayer.boundingBox();
    if (!workspace) throw new Error("Plasmon WindowLayer has no browser bounds");

    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    await selectDesktopRoot(app);
    await activateSelectedDesktopRoot(app, nativeWindows, initialWindowCount + 1);

    for (let index = 0; index < 60; index += 1) {
      await activateSelectedDesktopRoot(app, nativeWindows, initialWindowCount + 2);
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

test(
  "packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary",
  async ({ page }) => {
    const { app, kernelUrl } = await openInstalledPlasmon(page);
    const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
    try {
      const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
      const initialWindowCount = await nativeWindows.count();

      await selectDesktopRoot(app);
      await activateSelectedDesktopRoot(app, nativeWindows, initialWindowCount + 1);
      const firstId = await nativeWindows.last().getAttribute("data-window-id");
      if (!firstId) throw new Error("first Explorer window has no stable id");

      await activateSelectedDesktopRoot(app, nativeWindows, initialWindowCount + 2);
      const secondId = await nativeWindows.last().getAttribute("data-window-id");
      if (!secondId || secondId === firstId) throw new Error("second Explorer window has no distinct stable id");

      const first = app.locator(`.plasmon-window-layer [data-window-id="${firstId}"]`);
      const second = app.locator(`.plasmon-window-layer [data-window-id="${secondId}"]`);
      const switcher = app.getByRole("listbox", { name: "Window switcher" });
      await expect(second).toHaveClass(/plasmon-window--active/);

      await page.keyboard.down("Alt");
      await page.keyboard.press("Tab");
      await expect(switcher).toBeVisible();
      await expect(switcher.getByRole("option", { selected: true })).toHaveCount(1);
      await expect(switcher.locator("[role='option'][aria-selected='true'] .plasmon-shell__app-icon")).toBeVisible();
      await expect(second).toHaveClass(/plasmon-window--active/);
      await page.keyboard.press("Tab");
      await expect(second).toHaveClass(/plasmon-window--active/);
      await page.keyboard.press("Tab");
      await page.keyboard.up("Alt");
      await expect(switcher).toHaveCount(0);
      await expect(first).toHaveClass(/plasmon-window--active/);

      await first.getByRole("button", { name: "Minimize" }).click();
      await expect(first).toHaveClass(/plasmon-window--minimized/);
      await expect(second).toHaveClass(/plasmon-window--active/);
      await page.keyboard.down("Alt");
      await page.keyboard.press("Tab");
      await expect(switcher).toBeVisible();
      await page.keyboard.up("Alt");
      await expect(first).not.toHaveClass(/plasmon-window--minimized/);
      await expect(first).toHaveClass(/plasmon-window--active/);

      await page.keyboard.down("Alt");
      await page.keyboard.press("Tab");
      await expect(switcher).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(switcher).toHaveCount(0);
      await page.keyboard.up("Alt");
      await expect(first).toHaveClass(/plasmon-window--active/);

      await first.getByRole("button", { name: "Close" }).click();
      await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 10_000 });
      await page.keyboard.down("Alt");
      await page.keyboard.press("Tab");
      await expect(switcher).toHaveCount(0);
      await page.keyboard.up("Alt");
      await expect(second).toHaveClass(/plasmon-window--active/);

      health.assertClean();
    } finally {
      health.dispose();
    }
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
