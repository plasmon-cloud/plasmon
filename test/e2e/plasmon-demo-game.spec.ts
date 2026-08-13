import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "demo-game";

test("explicit packaged demo fixture opens through the normal js-dos desktop path", async ({ page, request }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error" || entry.type() === "warning") {
      consoleErrors.push(`${entry.type()}: ${entry.text()}`);
    }
  });
  page.on("requestfailed", (failed) => {
    failedRequests.push(`${failed.url()} :: ${failed.failure()?.errorText ?? "unknown failure"}`);
  });

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  const fixtureResponse = await request.get(
    new URL(`/app/${APP_ID}/fixtures/PlasmonDemo.jsdos`, kernelUrl).href,
  );
  expect(fixtureResponse.ok(), "demo fixture should be served from the installed Plasmon package").toBe(true);
  expect((await fixtureResponse.body()).length).toBeGreaterThan(0);

  // The fixture flag is startup configuration. Keep every installed Plasmon
  // main-document request flagged until the real application has completed
  // bootstrap. Kernel app-host setup can issue more than one document navigation;
  // releasing this route after only the first navigation would let a later
  // unflagged document replace the fixture-enabled boot.
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
  expect(fixtureRedirected, "the installed Plasmon document should be redirected to the explicit fixture URL").toBe(true);

  const frame = page.locator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(frame).toBeAttached();
  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  const activeAppUrl = new URL(await app.locator("html").evaluate(() => window.location.href));
  expect(activeAppUrl.searchParams.get(FIXTURE_PARAM)).toBe(FIXTURE_VALUE);
  await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);

  // Enter the fixture through ordinary filesystem UI. Directory navigation is
  // FileManager-owned; the .jsdos activation itself delegates to the canonical
  // filesystem dispatcher -> AssociationRegistry/OpenService -> Process/Windowing.
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();

  const explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(explorer).toBeVisible({ timeout: 20_000 });
  const games = explorer.locator("[data-fm-node-id]", { hasText: "Games" }).first();
  await expect(games).toBeVisible();
  await games.dblclick();

  // Explorer titles follow the active directory. Reacquire the same normal
  // FileManager surface by its canonical Games title after navigation rather
  // than continuing through the now-stale "This Plasmon" role locator.
  const gamesExplorer = app.getByRole("dialog", { name: "Games" }).last();
  await expect(gamesExplorer).toBeVisible({ timeout: 20_000 });
  const demo = gamesExplorer.locator("[data-fm-node-id]", { hasText: "Plasmon Demo.jsdos" }).first();
  await expect(demo).toBeVisible({ timeout: 20_000 });
  await demo.dblclick();

  // The runtime window stays generic by design; target filenames never become
  // game-title-specific product/runtime behavior.
  const gameWindow = app.getByRole("dialog", { name: "js-dos" }).last();
  await expect(gameWindow).toBeVisible({ timeout: 20_000 });
  const player = gameWindow.getByLabel("DOS game");
  try {
    await expect(player).toHaveAttribute("data-jsdos-ready", "true", { timeout: 60_000 });
  } catch (error) {
    const runtimeStatus = await gameWindow.locator('[role="status"], [role="alert"]').allTextContents();
    const canvases = await player.locator("canvas").count();
    const original = error instanceof Error ? error.message : String(error);
    throw new Error([
      original,
      `js-dos runtime status: ${JSON.stringify(runtimeStatus)}`,
      `js-dos canvas count: ${canvases}`,
      `browser console warnings/errors: ${JSON.stringify(consoleErrors)}`,
      `failed browser requests: ${JSON.stringify(failedRequests)}`,
      `page errors: ${JSON.stringify(pageErrors)}`,
    ].join("\n"));
  }
  await expect(player.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  // The self-authored demo accepts SPACE as gameplay input. Browser automation
  // does not OCR the emulator canvas; runtime readiness + rendered canvas + real
  // keyboard delivery are the package/browser boundary this lane can prove.
  await player.click();
  await page.keyboard.press("Space");

  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
