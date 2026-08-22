import { expect, test, type FrameLocator, type Locator, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function redirectToFirstDemo(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const root = `/app/${APP_ID}/`;
  const main = route.request().resourceType() === "document"
    && (url.pathname === root || url.pathname === `${root}index.html`);
  if (!main || url.searchParams.get("plasmon-fixture") === "first-demo") {
    await route.continue();
    return;
  }
  url.searchParams.set("plasmon-fixture", "first-demo");
  await route.fulfill({ status: 307, headers: { location: url.href, "cache-control": "no-store" } });
}

async function openSearchResult(app: FrameLocator, query: string): Promise<void> {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill(query);
  const result = search.locator("[data-search-result]", { hasText: query }).first();
  await expect(result).toBeVisible({ timeout: 15_000 });
  await result.click();
}

async function surfacePalette(surface: Locator): Promise<{ background: string; color: string; font: string }> {
  return surface.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, font: style.fontFamily };
  });
}

test("#112 — packaged representative apps expose shared chrome for visual review", async ({ page }, testInfo) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const fixtureRoute = `**/app/${APP_ID}/**`;
  await page.route(fixtureRoute, redirectToFirstDemo);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);

  const fixtureNavigation = page.waitForEvent("framenavigated", (candidate) => {
    try {
      const url = new URL(candidate.url());
      return (url.pathname === `/app/${APP_ID}/` || url.pathname === `/app/${APP_ID}/index.html`)
        && url.searchParams.get("plasmon-fixture") === "first-demo";
    } catch {
      return false;
    }
  });
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();
  await fixtureNavigation;

  const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appSelector).first()).toBeAttached();
  const app = page.frameLocator(appSelector).first();
  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  // first-demo is startup configuration. Keep the route active through real
  // Plasmon readiness because Kernel app-host setup can issue more than one
  // main-document navigation before bootstrap settles.
  await expect(taskbar).toBeVisible({ timeout: 30_000 });
  const activeAppUrl = new URL(await app.locator("html").evaluate(() => window.location.href));
  expect(activeAppUrl.searchParams.get("plasmon-fixture")).toBe("first-demo");
  await page.unroute(fixtureRoute, redirectToFirstDemo);

  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #112 shared native-app chrome",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #112 shared native-app chrome",
      },
    ],
  });

  try {
    await openSearchResult(app, "Settings");
    const settings = app.getByRole("dialog", { name: "Settings" }).last();
    await expect(settings).toBeVisible({ timeout: 20_000 });
    const settingsSurface = settings.locator(".plasmon-native-app-surface");
    await expect(settingsSurface).toBeVisible();
    await expect(settings.locator(".plasmon-native-app-panel")).toHaveCount(4);
    const sharedPalette = await surfacePalette(settingsSurface);
    await testInfo.attach("112-settings-current-theme.png", { body: await settings.screenshot(), contentType: "image/png" });

    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await rootShortcut.dblclick();
    const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    await rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();
    const documents = app.getByRole("dialog", { name: "Documents" }).last();
    await expect(documents).toBeVisible({ timeout: 20_000 });
    await documents.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first().dblclick();

    const text = app.getByRole("dialog", { name: "First Demo Notes.txt - Monaco Editor" }).last();
    await expect(text).toBeVisible({ timeout: 20_000 });
    const textSurface = text.locator(".plasmon-native-app-surface");
    await expect(textSurface).toBeVisible();
    await expect(text.locator(".plasmon-native-app-toolbar")).toBeVisible();
    await expect(text.locator(".plasmon-native-app-status")).toBeVisible();
    expect(await surfacePalette(textSurface)).toEqual(sharedPalette);
    await testInfo.attach("112-text-current-theme.png", { body: await text.screenshot(), contentType: "image/png" });

    // Reuse the repository-authored first-demo media fixture instead of importing
    // a new file. Creating a new node legitimately transitions from generic file
    // presentation to media presentation, which can cancel the superseded icon
    // request and adds an unrelated BrowserHealth race to this visual-review proof.
    await openSearchResult(app, "First Demo Artwork");
    const photos = app.getByRole("dialog", { name: "First Demo Artwork.svg" }).last();
    await expect(photos).toBeVisible({ timeout: 20_000 });
    const photosSurface = photos.locator(".plasmon-native-app-surface");
    await expect(photosSurface).toBeVisible();
    await expect(photos.locator(".plasmon-native-app-toolbar")).toBeVisible();
    await expect(photos.locator(".plasmon-native-app-status")).toBeVisible();
    expect(await surfacePalette(photosSurface)).toEqual(sharedPalette);
    await testInfo.attach("112-photos-current-theme.png", { body: await photos.screenshot(), contentType: "image/png" });

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
