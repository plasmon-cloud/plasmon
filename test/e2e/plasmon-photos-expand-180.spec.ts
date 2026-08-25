import { expect, test, type Locator, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";
const FIXTURE_NAME = "First Demo Artwork.svg";
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

async function waitForWindowMotionToSettle(window: Locator): Promise<void> {
  await window.evaluate(async (element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Native window element is unavailable");

    const activeAnimations = element.getAnimations().filter(
      (animation) => animation.playState === "pending" || animation.playState === "running",
    );
    await Promise.all(activeAnimations.map(async (animation) => {
      try {
        await animation.finished;
      } catch {
        // A superseded animation is not a readiness failure; the next geometry
        // read forces layout from the element's current canonical state.
      }
    }));
  });
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
  const fixtureRoute = `**/app/${APP_ID}/**`;
  let fixtureRedirected = false;
  let fixtureRouteInstalled = false;
  const redirectInitialPlasmonDocument = async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const appRoot = `/app/${APP_ID}/`;
    const isMainDocument = route.request().resourceType() === "document"
      && (requestUrl.pathname === appRoot || requestUrl.pathname === `${appRoot}index.html`);
    if (!isMainDocument || requestUrl.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE) {
      await route.continue();
      return;
    }

    fixtureRedirected = true;
    requestUrl.searchParams.set(FIXTURE_PARAM, FIXTURE_VALUE);
    await route.fulfill({
      status: 307,
      headers: {
        location: requestUrl.href,
        "cache-control": "no-store",
      },
    });
  };
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
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    // Reuse the repository-authored first-demo image through the production
    // demo seed contract. This avoids the unrelated Neutron Files import RPC
    // while preserving filesystem -> association -> Process/Windowing -> Photos.
    await page.route(fixtureRoute, redirectInitialPlasmonDocument);
    fixtureRouteInstalled = true;
    const fixtureNavigation = page.waitForEvent("framenavigated", (candidate) => {
      try {
        const url = new URL(candidate.url());
        return (url.pathname === `/app/${APP_ID}/` || url.pathname === `/app/${APP_ID}/index.html`)
          && url.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE;
      } catch {
        return false;
      }
    });

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();
    await fixtureNavigation;
    expect(fixtureRedirected, "installed Plasmon should boot with the explicit first-demo flag").toBe(true);

    const plasmonSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(plasmonSelector).first()).toBeAttached();
    const plasmon = page.frameLocator(plasmonSelector).first();
    await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    const activeAppUrl = new URL(await plasmon.locator("html").evaluate(() => window.location.href));
    expect(activeAppUrl.searchParams.get(FIXTURE_PARAM)).toBe(FIXTURE_VALUE);
    await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);
    fixtureRouteInstalled = false;

    const windowLayer = plasmon.locator(".plasmon-window-layer").first();
    await expect(windowLayer).toBeVisible({ timeout: 30_000 });

    // Open the authored image through normal Search -> AssociationRegistry ->
    // OpenService dispatch. #180 does not depend on Files import behavior.
    await plasmon.getByRole("button", { name: "Search" }).click();
    const search = plasmon.getByLabel("Search Plasmon");
    await expect(search).toBeVisible();
    await search.fill("First Demo Artwork");
    const artworkResult = plasmon.locator("[data-search-result]", { hasText: FIXTURE_NAME }).first();
    await expect(artworkResult).toBeVisible({ timeout: 15_000 });
    await artworkResult.click();

    const photosWindow = plasmon.getByRole("dialog", { name: FIXTURE_NAME }).last();
    await expect(photosWindow).toBeVisible({ timeout: 20_000 });
    const photos = photosWindow.locator("[data-photos-display-mode]");
    await expect(photos).toHaveAttribute("data-photos-display-mode", "normal");
    await expect(photosWindow.getByRole("img", { name: FIXTURE_NAME })).toBeVisible();

    // This is the actual installed Neutron feature policy, not a stubbed browser
    // API. The fallback must stay inside Plasmon and leave document fullscreen empty.
    expect(await photos.evaluate(() => document.fullscreenEnabled)).toBe(false);
    expect(await photos.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(photosWindow).not.toHaveClass(/plasmon-window--maximized/);

    // Visibility can become true while the native window's opening transform
    // animation is still running. Capture the restore baseline only after that
    // real browser animation lifecycle settles, rather than snapshotting a
    // transient transformed box.
    await waitForWindowMotionToSettle(photosWindow);
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
    // First prove canonical state reached that contract, then prove the browser
    // renders that state over the same visible workspace rather than scrolling
    // the WindowLayer away from its manager-owned coordinate origin.
    await expect.poll(() => hasMaximizedManagerGeometry(photosWindow)).toBe(true);
    expect(await hasMaximizedManagerGeometry(photosWindow)).toBe(true);
    await expect.poll(async () => {
      const workspace = await windowLayer.boundingBox();
      const expanded = await photosWindow.boundingBox();
      return !!workspace && !!expanded && geometryMatches(expanded, workspace);
    }).toBe(true);

    const workspaceExpanded = await windowLayer.boundingBox();
    const expanded = await photosWindow.boundingBox();
    if (!workspaceExpanded || !expanded) throw new Error("Expanded Photos has no packaged workspace geometry");
    expect(geometryMatches(expanded, workspaceExpanded)).toBe(true);

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
    if (fixtureRouteInstalled) await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
