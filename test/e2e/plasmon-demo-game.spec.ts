import { expect, test, type Locator, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "demo-game";
const DEMO_ARTWORK_PATH = "static/plasmon/artwork/plasmon-demo.svg";

async function activateFileManagerEntry(entry: Locator): Promise<void> {
  await entry.click();
  await expect(entry).toHaveAttribute("aria-selected", "true");
  await entry.press("Enter");
}

// #250 preserves the prior fail-then-pass evidence from Packaged Browser #884.
// This acceptance remains required under the serialized Specialist harness and
// is intentionally not an active r2 quarantine.
test(
  "explicit packaged demo fixture opens through the normal js-dos desktop path",
  { tag: ["@issue-250", "@issue-123", "@issue-202", "@issue-64"] },
  async ({ page, request }) => {
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

  const artworkResponse = await request.get(
    new URL(`/app/${APP_ID}/${DEMO_ARTWORK_PATH}`, kernelUrl).href,
  );
  expect(artworkResponse.ok(), "demo artwork should be served from the installed Plasmon package").toBe(true);
  expect((await artworkResponse.body()).length).toBeGreaterThan(0);

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

  // Enter the fixture through ordinary filesystem UI. Select each FileManager
  // entry and use its production keyboard activation path so React selection is
  // committed before openNode delegates to the canonical filesystem dispatcher
  // -> AssociationRegistry/OpenService -> Process/Windowing.
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await activateFileManagerEntry(rootShortcut);

  const explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(explorer).toBeVisible({ timeout: 20_000 });
  const games = explorer.locator("[data-fm-node-id]", { hasText: "Games" }).first();
  await expect(games).toBeVisible();
  await activateFileManagerEntry(games);

  // Explorer titles follow the active directory. Reacquire the same normal
  // FileManager surface by its canonical Games title after navigation rather
  // than continuing through the now-stale "This Plasmon" role locator.
  const gamesExplorer = app.getByRole("dialog", { name: "Games" }).last();
  await expect(gamesExplorer).toBeVisible({ timeout: 20_000 });
  const demo = gamesExplorer.locator("[data-fm-node-id]", { hasText: "Plasmon Demo.jsdos" }).first();
  await expect(demo).toBeVisible({ timeout: 20_000 });

  // #123 browser boundary: the ordinary FileManager resource consumes the
  // shared thumbnail primitive and the package-local artwork must decode.
  const artwork = demo.locator("img.plasmon-media-thumbnail").first();
  await expect(artwork).toHaveAttribute("src", DEMO_ARTWORK_PATH);
  await expect.poll(
    () => artwork.evaluate((image) => image instanceof HTMLImageElement ? image.naturalWidth : 0),
    { timeout: 20_000 },
  ).toBeGreaterThan(0);

  await activateFileManagerEntry(demo);

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

  // #202 owner-level browser regression: the real packaged runtime must not
  // probe origin-backed storage APIs that the intended opaque sandbox denies.
  expect(
    consoleErrors.filter((message) => message.includes("Failed to execute 'estimate' on 'StorageManager'")),
    "js-dos must not emit the sandbox-incompatible StorageManager.estimate error",
  ).toEqual([]);
  expect(
    consoleErrors.filter((message) => message.includes("Storage directory access is denied because the context is sandboxed")),
    "js-dos must not emit the sandbox-denied storage-directory error",
  ).toEqual([]);

  // #64 owner-level persistence boundary: the self-authored demo creates
  // SCORE.DAT and updates it on SPACE. A normal Process close must persist the
  // engine-exported change set into canonical Plasmon filesystem state before
  // the window is allowed to disappear.
  await player.click();
  await page.keyboard.press("Space");
  await gameWindow.getByRole("button", { name: "Close" }).click();
  await expect(gameWindow).not.toBeVisible({ timeout: 20_000 });

  // Reopen the same stable filesystem resource through the same generic
  // FileManager -> AssociationRegistry/OpenService path. The new runtime must
  // consume the filesystem-backed change set before gameplay readiness.
  await activateFileManagerEntry(demo);
  const reopenedWindow = app.getByRole("dialog", { name: "js-dos" }).last();
  await expect(reopenedWindow).toBeVisible({ timeout: 20_000 });
  const reopenedPlayer = reopenedWindow.getByLabel("DOS game");
  await expect(reopenedPlayer).toHaveAttribute("data-jsdos-progress-restored", "true", { timeout: 60_000 });
  await expect(reopenedPlayer).toHaveAttribute("data-jsdos-ready", "true", { timeout: 60_000 });
  await expect(reopenedPlayer.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  // The reopened runtime is still subject to #202's opaque-frame storage
  // boundary; persistence must not regress into origin-backed storage errors.
  expect(
    consoleErrors.filter((message) => message.includes("Failed to execute 'estimate' on 'StorageManager'")),
  ).toEqual([]);
  expect(
    consoleErrors.filter((message) => message.includes("Storage directory access is denied because the context is sandboxed")),
  ).toEqual([]);

  expect(pageErrors).toEqual([]);
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
