import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";

test("flake-summary example failure one", async () => {
  expect("actual-one").toBe("expected-one");
});

test("flake-summary example failure two", async () => {
  expect("actual-two").toBe("expected-two");
});

test("explicit first-demo fixtures are discoverable through packaged FileManager, Search, and native apps", async ({ page }) => {
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

  // first-demo is startup configuration. Keep every installed Plasmon main
  // document navigation flagged until real application bootstrap completes;
  // Kernel app-host setup may issue more than one document navigation.
  const fixtureRoute = `**/app/${APP_ID}/**`;
  let fixtureRedirected = false;
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
  await page.route(fixtureRoute, redirectInitialPlasmonDocument);

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

  const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appFrameSelector).first()).toBeAttached();
  const app = page.frameLocator(appFrameSelector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  const activeAppUrl = new URL(await app.locator("html").evaluate(() => window.location.href));
  expect(activeAppUrl.searchParams.get(FIXTURE_PARAM)).toBe(FIXTURE_VALUE);
  await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);

  // FileManager proof: first-demo Documents are ordinary filesystem resources,
  // reached through the same Root shortcut and Explorer navigation as user data.
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();

  const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
  const documents = rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
  await expect(documents).toBeVisible();
  await documents.dblclick();

  const documentsExplorer = app.getByRole("dialog", { name: "Documents" }).last();
  await expect(documentsExplorer).toBeVisible({ timeout: 20_000 });
  const notes = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first();
  const guide = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Guide.md" }).first();
  await expect(notes).toBeVisible();
  await expect(guide).toBeVisible();

  // Open the text resource through normal FileManager activation and prove the
  // production native association reaches the real Text editor.
  await notes.dblclick();
  const textWindow = app.getByRole("dialog", { name: "First Demo Notes.txt" }).last();
  await expect(textWindow).toBeVisible({ timeout: 20_000 });
  await expect(textWindow.getByLabel("Text editor")).toBeVisible();

  // Search sees both document and media fixture classes through the production
  // filesystem inventory. Markdown discovery is asserted without duplicating
  // Text/Markdown editor semantics already covered below Playwright.
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByLabel("Search Plasmon");
  await expect(search).toBeVisible();
  await search.fill("First Demo Guide");
  await expect(app.locator("[data-search-result]", { hasText: "First Demo Guide.md" }).first()).toBeVisible({ timeout: 15_000 });

  // The authored SVG is classified as Media and opens from Search through the
  // same AssociationRegistry/OpenService path as ordinary user images.
  await search.fill("First Demo Artwork");
  const artworkResult = app.locator("[data-search-result]", { hasText: "First Demo Artwork.svg" }).first();
  await expect(artworkResult).toBeVisible({ timeout: 15_000 });
  await artworkResult.click();

  const photosWindow = app.getByRole("dialog", { name: "First Demo Artwork.svg" }).last();
  await expect(photosWindow).toBeVisible({ timeout: 20_000 });
  await expect(photosWindow.getByLabel("Photos")).toBeVisible();
  const artwork = photosWindow.getByRole("img", { name: "First Demo Artwork.svg" });
  await expect(artwork).toBeVisible({ timeout: 20_000 });
  const artworkBounds = await artwork.boundingBox();
  expect(artworkBounds?.width ?? 0).toBeGreaterThan(0);
  expect(artworkBounds?.height ?? 0).toBeGreaterThan(0);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
