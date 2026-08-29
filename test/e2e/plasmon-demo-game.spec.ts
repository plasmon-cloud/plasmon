import {
  expect,
  test,
  type APIRequestContext,
  type FrameLocator,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
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

type SavedDemoContext = {
  app: FrameLocator;
  savedDemo: Locator;
  pageErrors: string[];
  consoleErrors: string[];
};

async function savePackagedDemoGame(
  page: Page,
  request: APIRequestContext,
  options: { verifyStaticArtwork: boolean },
): Promise<SavedDemoContext> {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error" || entry.type() === "warning") consoleErrors.push(`${entry.type()}: ${entry.text()}`);
  });
  page.on("requestfailed", (failed) => failedRequests.push(`${failed.url()} :: ${failed.failure()?.errorText ?? "unknown failure"}`));

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  const fixtureResponse = await request.get(new URL(`/app/${APP_ID}/fixtures/PlasmonDemo.jsdos`, kernelUrl).href);
  expect(fixtureResponse.ok(), "demo fixture should be served from the installed Plasmon package").toBe(true);
  expect((await fixtureResponse.body()).length).toBeGreaterThan(0);
  const artworkResponse = await request.get(new URL(`/app/${APP_ID}/${DEMO_ARTWORK_PATH}`, kernelUrl).href);
  expect(artworkResponse.ok(), "demo artwork should be served from the installed Plasmon package").toBe(true);
  expect((await artworkResponse.body()).length).toBeGreaterThan(0);

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
    await route.fulfill({ status: 307, headers: { location: requestUrl.href, "cache-control": "no-store" } });
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

  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await activateFileManagerEntry(rootShortcut);
  const explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(explorer).toBeVisible({ timeout: 20_000 });
  const games = explorer.locator("[data-fm-node-id]", { hasText: "Games" }).first();
  await expect(games).toBeVisible();
  await activateFileManagerEntry(games);
  const gamesExplorer = app.getByRole("dialog", { name: "Games" }).last();
  await expect(gamesExplorer).toBeVisible({ timeout: 20_000 });
  const demo = gamesExplorer.locator("[data-fm-node-id]", { hasText: "Plasmon Demo.jsdos" }).first();
  await expect(demo).toBeVisible({ timeout: 20_000 });

  if (options.verifyStaticArtwork) {
    const artwork = demo.locator("img.plasmon-media-thumbnail").first();
    await expect(artwork).toHaveAttribute("src", DEMO_ARTWORK_PATH);
    await expect.poll(() => artwork.evaluate((image) => image instanceof HTMLImageElement ? image.naturalWidth : 0), { timeout: 20_000 }).toBeGreaterThan(0);
  }

  await activateFileManagerEntry(demo);
  const gameWindow = app.getByRole("dialog", { name: "js-dos" }).last();
  await expect(gameWindow).toBeVisible({ timeout: 20_000 });
  const player = gameWindow.getByLabel("DOS game");
  try {
    await expect(player).toHaveAttribute("data-jsdos-ready", "true", { timeout: 60_000 });
  } catch (error) {
    const runtimeStatus = await gameWindow.locator('[role="status"], [role="alert"]').allTextContents();
    const canvases = await player.locator("canvas").count();
    const original = error instanceof Error ? error.message : String(error);
    throw new Error([original, `js-dos runtime status: ${JSON.stringify(runtimeStatus)}`, `js-dos canvas count: ${canvases}`, `browser console warnings/errors: ${JSON.stringify(consoleErrors)}`, `failed browser requests: ${JSON.stringify(failedRequests)}`, `page errors: ${JSON.stringify(pageErrors)}`].join("\n"));
  }
  await expect(player.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  expect(consoleErrors.filter((message) => message.includes("Failed to execute 'estimate' on 'StorageManager'")), "js-dos must not emit the sandbox-incompatible StorageManager.estimate error").toEqual([]);
  expect(consoleErrors.filter((message) => message.includes("Storage directory access is denied because the context is sandboxed")), "js-dos must not emit the sandbox-denied storage-directory error").toEqual([]);

  await player.click();
  await page.keyboard.press("Space");
  await gameWindow.getByRole("button", { name: "Close" }).click();
  await expect(gameWindow).not.toBeVisible({ timeout: 20_000 });
  await gamesExplorer.getByRole("button", { name: "Close" }).click();
  await expect(gamesExplorer).not.toBeVisible({ timeout: 20_000 });
  await activateFileManagerEntry(rootShortcut);
  const savedRootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(savedRootExplorer).toBeVisible({ timeout: 20_000 });
  const savedGames = savedRootExplorer.locator("[data-fm-node-id]", { hasText: "Games" }).first();
  await expect(savedGames).toBeVisible();
  await activateFileManagerEntry(savedGames);
  const savedGamesExplorer = app.getByRole("dialog", { name: "Games" }).last();
  await expect(savedGamesExplorer).toBeVisible({ timeout: 20_000 });
  const savedDemo = savedGamesExplorer.locator("[data-fm-node-id]", { hasText: "Plasmon Demo.jsdos" }).first();
  await expect(savedDemo).toBeVisible({ timeout: 20_000 });
  return { app, savedDemo, pageErrors, consoleErrors };
}

// #250/#123/#202/#64 remain required. #124's flaky blob-publication assertion
// is isolated below instead of quarantining this normal packaged demo journey.
test(
  "explicit packaged demo fixture opens through the normal js-dos desktop path",
  { tag: ["@issue-250", "@issue-123", "@issue-202", "@issue-64"] },
  async ({ page, request }) => {
    const { app, savedDemo, pageErrors, consoleErrors } = await savePackagedDemoGame(page, request, { verifyStaticArtwork: true });
    await activateFileManagerEntry(savedDemo);
    const reopenedWindow = app.getByRole("dialog", { name: "js-dos" }).last();
    await expect(reopenedWindow).toBeVisible({ timeout: 20_000 });
    const reopenedPlayer = reopenedWindow.getByLabel("DOS game");
    await expect(reopenedPlayer).toHaveAttribute("data-jsdos-progress-restored", "true", { timeout: 60_000 });
    await expect(reopenedPlayer).toHaveAttribute("data-jsdos-ready", "true", { timeout: 60_000 });
    await expect(reopenedPlayer.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
    expect(consoleErrors.filter((message) => message.includes("Failed to execute 'estimate' on 'StorageManager'"))).toEqual([]);
    expect(consoleErrors.filter((message) => message.includes("Storage directory access is denied because the context is sandboxed"))).toEqual([]);
    expect(pageErrors).toEqual([]);
  },
);

// #304 quarantines exactly the flaky #124 browser-readiness observation. The
// blob: requirement remains executable debt; static package artwork is not an
// acceptable substitute. Targeted flake-probe validation runs this with retries=0.
test(
  "saved js-dos resource publishes a blob-backed preview after save",
  { tag: ["@r2-quarantine", "@issue-124", "@issue-304"] },
  async ({ page, request }) => {
    const { savedDemo, pageErrors } = await savePackagedDemoGame(page, request, { verifyStaticArtwork: false });
    const savePreview = savedDemo.locator("img.plasmon-media-thumbnail").first();
    await expect(savePreview).toHaveAttribute("src", /^blob:/, { timeout: 20_000 });
    await expect.poll(() => savePreview.evaluate((image) => image instanceof HTMLImageElement ? image.naturalWidth : 0), { timeout: 20_000 }).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
