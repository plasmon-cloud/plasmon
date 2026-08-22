import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const SVG_FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64"><rect width="96" height="64" fill="#4969d8"/><circle cx="48" cy="32" r="18" fill="#f2f4ff"/></svg>`;
const GEOMETRY_TOLERANCE_PX = 1;

function geometryMatches(
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
): boolean {
  return Math.abs(actual.x - expected.x) <= GEOMETRY_TOLERANCE_PX
    && Math.abs(actual.y - expected.y) <= GEOMETRY_TOLERANCE_PX
    && Math.abs(actual.width - expected.width) <= GEOMETRY_TOLERANCE_PX
    && Math.abs(actual.height - expected.height) <= GEOMETRY_TOLERANCE_PX;
}

async function hasMaximizedManagerGeometry(window: Locator): Promise<boolean> {
  return window.evaluate((element) => {
    if (!(element instanceof HTMLElement)) return false;
    const layer = element.parentElement;
    if (!(layer instanceof HTMLElement)) return false;

    const parsePixels = (value: string): number => Number.parseFloat(value || "NaN");
    const left = parsePixels(element.style.left);
    const top = parsePixels(element.style.top);
    const width = parsePixels(element.style.width);
    const height = parsePixels(element.style.height);
    const tolerance = 1;

    return Number.isFinite(left)
      && Number.isFinite(top)
      && Number.isFinite(width)
      && Number.isFinite(height)
      && Math.abs(left) <= tolerance
      && Math.abs(top) <= tolerance
      && Math.abs(width - layer.clientWidth) <= tolerance
      && Math.abs(height - layer.clientHeight) <= tolerance;
  });
}

test("#180 — packaged Photos expands inside Plasmon when browser fullscreen is denied", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #180; this gate exercises the real packaged Photos sandbox",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #180 Photos fullscreen fallback",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #180 Photos fullscreen fallback",
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
    const windowLayer = plasmon.locator(".plasmon-window-layer").first();
    await expect(windowLayer).toBeVisible({ timeout: 30_000 });

    // Import a real image through Explorer so activation continues through the
    // normal filesystem -> association -> Process/Windowing -> Photos path.
    const windows = windowLayer.locator("[data-window-id]");
    const initialWindowCount = await windows.count();
    const rootShortcut = plasmon.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    await expect(windows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

    const explorer = windows.last();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/");
    const fixtureName = `photos-expand-${Date.now()}.svg`;
    const chooserPromise = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: fixtureName,
      mimeType: "image/svg+xml",
      buffer: Buffer.from(SVG_FIXTURE),
    });

    const fixture = explorer.locator("[data-fm-node-id]", { hasText: fixtureName }).first();
    await expect(fixture).toBeVisible({ timeout: 20_000 });
    await fixture.dblclick();

    const photosWindow = plasmon.getByRole("dialog", { name: fixtureName }).last();
    await expect(photosWindow).toBeVisible({ timeout: 20_000 });
    const photos = photosWindow.locator("[data-photos-display-mode]");
    await expect(photos).toHaveAttribute("data-photos-display-mode", "normal");
    await expect(photosWindow.getByRole("img", { name: fixtureName })).toBeVisible();

    // This is the actual installed Neutron feature policy, not a stubbed browser
    // API. The fallback must stay inside Plasmon and leave document fullscreen empty.
    expect(await photos.evaluate(() => document.fullscreenEnabled)).toBe(false);
    expect(await photos.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(photosWindow).not.toHaveClass(/plasmon-window--maximized/);

    const floatingBefore = await photosWindow.boundingBox();
    if (!floatingBefore) throw new Error("Photos has no packaged window geometry");

    await photosWindow.getByRole("button", { name: "Expand" }).click();
    await expect(photos).toHaveAttribute("data-photos-display-mode", "expanded");
    await expect(photosWindow).toHaveClass(/plasmon-window--maximized/);
    await expect(photosWindow.getByRole("status")).toContainText(
      "Browser fullscreen is unavailable in this hosted view. Using expanded view instead.",
    );
    expect(await photos.evaluate(() => document.fullscreenElement)).toBeNull();

    // WindowManager defines maximized geometry from WindowLayer client bounds.
    // Assert that production state directly instead of comparing Playwright outer
    // border boxes, which include window chrome and are not the manager contract.
    await expect.poll(() => hasMaximizedManagerGeometry(photosWindow)).toBe(true);
    expect(await hasMaximizedManagerGeometry(photosWindow)).toBe(true);

    await photosWindow.getByRole("button", { name: "Exit expanded" }).click();
    await expect(photos).toHaveAttribute("data-photos-display-mode", "normal");
    await expect(photosWindow).not.toHaveClass(/plasmon-window--maximized/);

    await expect.poll(async () => {
      const restored = await photosWindow.boundingBox();
      return !!restored && geometryMatches(restored, floatingBefore);
    }).toBe(true);

    const restored = await photosWindow.boundingBox();
    if (!restored) throw new Error("Restored Photos has no packaged window geometry");
    expect(geometryMatches(restored, floatingBefore)).toBe(true);

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
