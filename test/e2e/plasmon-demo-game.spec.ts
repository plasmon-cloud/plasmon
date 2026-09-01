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
const REQUIRED_JSDOS_RUNTIME_ASSETS = [
  "js-dos.js",
  "js-dos.css",
  "emulators/emulators.js",
  "emulators/wdosbox.js",
  "emulators/wdosbox.wasm",
] as const;

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
  const kernelOrigin = new URL(kernelUrl).origin;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const runtimeAssetRequests = new Set<string>();
  const unapprovedRuntimeRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error" || entry.type() === "warning") consoleErrors.push(`${entry.type()}: ${entry.text()}`);
  });
  page.on("requestfailed", (failed) => failedRequests.push(`${failed.url()} :: ${failed.failure()?.errorText ?? "unknown failure"}`));
  page.on("request", (browserRequest) => {
    try {
      const url = new URL(browserRequest.url());
      for (const asset of REQUIRED_JSDOS_RUNTIME_ASSETS) {
        if (!url.pathname.endsWith(`/${asset}`)) continue;
        const expectedPath = `/app/${APP_ID}/runtime/jsdos/${asset}`;
        if (url.origin === kernelOrigin && url.pathname === expectedPath) {
          runtimeAssetRequests.add(asset);
        } else {
          unapprovedRuntimeRequests.push(url.href);
        }
      }
    } catch {
      // Non-URL request values are irrelevant to packaged runtime authority.
    }
  });

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  const fixtureResponse = await request.get(new URL(`/app/${APP_ID}/fixtures/PlasmonDemo.jsdos`, kernelUrl).href);
  expect(fixtureResponse.ok(), "demo fixture should be served from the installed Plasmon package").toBe(true);
  expect((await fixtureResponse.body()).length).toBeGreaterThan(0);

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
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible();
  const activeAppUrl = new URL(await app.locator("html").evaluate(() => window.location.href));
  expect(activeAppUrl.searchParams.get(FIXTURE_PARAM)).toBe(FIXTURE_VALUE);
  await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);

  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible();
  await activateFileManagerEntry(rootShortcut);
  const explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(explorer).toBeVisible();
  const games = explorer.locator("[data-fm-node-id]", { hasText: "Games" }).first();
  await expect(games).toBeVisible();
  await activateFileManagerEntry(games);
  const gamesExplorer = app.getByRole("dialog", { name: "Games" }).last();
  await expect(gamesExplorer).toBeVisible();
  const demo = gamesExplorer.locator("[data-fm-node-id]", { hasText: "Plasmon Demo.jsdos" }).first();
  await expect(demo).toBeVisible();

  if (options.verifyStaticArtwork) {
    const artwork = demo.locator("img.plasmon-media-thumbnail").first();
    await expect(artwork).toHaveAttribute("src", DEMO_ARTWORK_PATH);
    await expect.poll(() => artwork.evaluate((image) => image instanceof HTMLImageElement ? image.naturalWidth : 0)).toBeGreaterThan(0);
  }

  await activateFileManagerEntry(demo);
  const gameWindow = app.getByRole("dialog", { name: "js-dos" }).last();
  await expect(gameWindow).toBeVisible();
  const player = gameWindow.getByLabel("DOS game");
  try {
    await expect(player).toHaveAttribute("data-jsdos-ready", "true");
  } catch (error) {
    const runtimeStatus = await gameWindow.locator('[role="status"], [role="alert"]').allTextContents();
    const canvases = await player.locator("canvas").count();
    const original = error instanceof Error ? error.message : String(error);
    throw new Error([original, `js-dos runtime status: ${JSON.stringify(runtimeStatus)}`, `js-dos canvas count: ${canvases}`, `browser console warnings/errors: ${JSON.stringify(consoleErrors)}`, `failed browser requests: ${JSON.stringify(failedRequests)}`, `page errors: ${JSON.stringify(pageErrors)}`].join("\n"));
  }

  const canvas = player.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox?.width ?? 0, "js-dos canvas must render non-zero width").toBeGreaterThan(0);
  expect(canvasBox?.height ?? 0, "js-dos canvas must render non-zero height").toBeGreaterThan(0);
  expect([...runtimeAssetRequests].sort()).toEqual([...REQUIRED_JSDOS_RUNTIME_ASSETS].sort());
  expect(unapprovedRuntimeRequests, "js-dos executable assets must come only from the installed package").toEqual([]);

  expect(consoleErrors.filter((message) => message.includes("Failed to execute 'estimate' on 'StorageManager'")), "js-dos must not emit the sandbox-incompatible StorageManager.estimate error").toEqual([]);
  expect(consoleErrors.filter((message) => message.includes("Storage directory access is denied because the context is sandboxed")), "js-dos must not emit the sandbox-denied storage-directory error").toEqual([]);

  const beforeInputFrame = await canvas.screenshot();
  await player.click();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await canvas.screenshot()).equals(beforeInputFrame)).toBe(false);

  await gameWindow.getByRole("button", { name: "Close" }).click();
  await expect(gameWindow).not.toBeVisible();
  await gamesExplorer.getByRole("button", { name: "Close" }).click();
  await expect(gamesExplorer).not.toBeVisible();
  await activateFileManagerEntry(rootShortcut);
  const savedRootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(savedRootExplorer).toBeVisible();
  const savedGames = savedRootExplorer.locator("[data-fm-node-id]", { hasText: "Games" }).first();
  await expect(savedGames).toBeVisible();
  await activateFileManagerEntry(savedGames);
  const savedGamesExplorer = app.getByRole("dialog", { name: "Games" }).last();
  await expect(savedGamesExplorer).toBeVisible();
  const savedDemo = savedGamesExplorer.locator("[data-fm-node-id]", { hasText: "Plasmon Demo.jsdos" }).first();
  await expect(savedDemo).toBeVisible();
  return { app, savedDemo, pageErrors, consoleErrors };
}

test(
  "explicit packaged js-dos fixture opens, accepts input, saves, and restores through the normal desktop path",
  async ({ page, request }) => {
    const { app, savedDemo, pageErrors, consoleErrors } = await savePackagedDemoGame(page, request, { verifyStaticArtwork: false });
    await activateFileManagerEntry(savedDemo);
    const reopenedWindow = app.getByRole("dialog", { name: "js-dos" }).last();
    await expect(reopenedWindow).toBeVisible();
    const reopenedPlayer = reopenedWindow.getByLabel("DOS game");
    await expect(reopenedPlayer).toHaveAttribute("data-jsdos-progress-restored", "true");
    await expect(reopenedPlayer).toHaveAttribute("data-jsdos-ready", "true");
    const reopenedCanvas = reopenedPlayer.locator("canvas").first();
    await expect(reopenedCanvas).toBeVisible();
    const reopenedCanvasBox = await reopenedCanvas.boundingBox();
    expect(reopenedCanvasBox?.width ?? 0).toBeGreaterThan(0);
    expect(reopenedCanvasBox?.height ?? 0).toBeGreaterThan(0);
    expect(consoleErrors.filter((message) => message.includes("Failed to execute 'estimate' on 'StorageManager'"))).toEqual([]);
    expect(consoleErrors.filter((message) => message.includes("Storage directory access is denied because the context is sandboxed"))).toEqual([]);
    expect(pageErrors).toEqual([]);
  },
);

// The machine-readable quarantine isolates exactly the flaky saved-preview
// browser-readiness observation. The blob: requirement remains executable debt;
// static package artwork is not an acceptable substitute. Targeted flake-probe
// validation runs this with retries=0.
test(
  "saved js-dos resource publishes a blob-backed preview after save",
  { tag: ["@quarantine", "@saved-preview"] },
  async ({ page, request }) => {
    const { savedDemo, pageErrors } = await savePackagedDemoGame(page, request, { verifyStaticArtwork: false });
    const savePreview = savedDemo.locator("img.plasmon-media-thumbnail").first();
    await expect(savePreview).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => savePreview.evaluate((image) => image instanceof HTMLImageElement ? image.naturalWidth : 0)).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
