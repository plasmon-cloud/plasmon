import { expect, test, type Locator, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const SVG_FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100"><rect width="160" height="100" fill="#253047"/><circle cx="80" cy="50" r="28" fill="#d6e1ff"/></svg>`;

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

async function openSearchResult(app: ReturnType<Parameters<typeof test>[0]["page"]["frameLocator"]>, query: string): Promise<void> {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  const input = search.getByRole("textbox", { name: "Search Plasmon" });
  await input.fill(query);
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
  await page.unroute(fixtureRoute, redirectToFirstDemo);

  const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appSelector)).toBeVisible();
  const app = page.frameLocator(appSelector);
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

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

  let theme: Locator | null = null;
  let originalTheme: string | null = null;
  try {
    // Utility/system representative: Settings owns its semantics while consuming
    // the shared content surface/panel vocabulary.
    await openSearchResult(app, "Settings");
    const settings = app.getByRole("dialog", { name: "Settings" }).last();
    await expect(settings).toBeVisible({ timeout: 20_000 });
    const settingsSurface = settings.locator(".plasmon-native-app-surface");
    await expect(settingsSurface).toBeVisible();
    await expect(settings.locator(".plasmon-native-app-panel")).toHaveCount(4);
    theme = settings.getByLabel("Theme");
    await expect(theme).toBeVisible();
    originalTheme = await theme.inputValue();

    await theme.selectOption("light");
    const lightPalette = await surfacePalette(settingsSurface);
    await testInfo.attach("112-settings-light.png", {
      body: await settings.screenshot(),
      contentType: "image/png",
    });

    await theme.selectOption("dark");
    const darkPalette = await surfacePalette(settingsSurface);
    expect(darkPalette.background).not.toBe(lightPalette.background);
    expect(darkPalette.color).not.toBe(lightPalette.color);
    expect(darkPalette.font).toBe(lightPalette.font);
    await testInfo.attach("112-settings-dark.png", {
      body: await settings.screenshot(),
      contentType: "image/png",
    });

    // Editor representative: open the canonical first-demo Text document through
    // the real filesystem/association/process/window path.
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    await rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();
    const documents = app.getByRole("dialog", { name: "Documents" }).last();
    await expect(documents).toBeVisible({ timeout: 20_000 });
    const notes = documents.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first();
    await expect(notes).toBeVisible();
    await notes.dblclick();

    const text = app.getByRole("dialog", { name: "First Demo Notes.txt - Monaco Editor" }).last();
    await expect(text).toBeVisible({ timeout: 20_000 });
    const textSurface = text.locator(".plasmon-native-app-surface");
    await expect(textSurface).toBeVisible();
    await expect(text.locator(".plasmon-native-app-toolbar")).toBeVisible();
    await expect(text.locator(".plasmon-native-app-status")).toBeVisible();
    const textPalette = await surfacePalette(textSurface);
    expect(textPalette.background).toBe(darkPalette.background);
    expect(textPalette.color).toBe(darkPalette.color);
    expect(textPalette.font).toBe(darkPalette.font);
    await testInfo.attach("112-text-dark.png", {
      body: await text.screenshot(),
      contentType: "image/png",
    });

    // Media representative: import a real SVG through Explorer and open it via
    // canonical association dispatch into Photos.
    const filesTask = app.getByRole("navigation", { name: "Taskbar" }).getByRole("button", { name: /^Files;/ }).first();
    await filesTask.click();
    await expect(documents).toHaveClass(/plasmon-window--active/);
    const fixtureName = `native-app-chrome-${Date.now()}.svg`;
    const chooserPromise = page.waitForEvent("filechooser");
    await documents.getByRole("button", { name: "Import Files…" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: fixtureName, mimeType: "image/svg+xml", buffer: Buffer.from(SVG_FIXTURE) });
    const fixture = documents.locator("[data-fm-node-id]", { hasText: fixtureName }).first();
    await expect(fixture).toBeVisible({ timeout: 20_000 });
    await fixture.dblclick();

    const photos = app.getByRole("dialog", { name: fixtureName }).last();
    await expect(photos).toBeVisible({ timeout: 20_000 });
    const photosSurface = photos.locator(".plasmon-native-app-surface");
    await expect(photosSurface).toBeVisible();
    await expect(photos.locator(".plasmon-native-app-toolbar")).toBeVisible();
    await expect(photos.locator(".plasmon-native-app-status")).toBeVisible();
    const photosPalette = await surfacePalette(photosSurface);
    expect(photosPalette.background).toBe(darkPalette.background);
    expect(photosPalette.color).toBe(darkPalette.color);
    expect(photosPalette.font).toBe(darkPalette.font);
    await testInfo.attach("112-photos-dark.png", {
      body: await photos.screenshot(),
      contentType: "image/png",
    });

    health.assertClean();
  } finally {
    if (theme && originalTheme) {
      try {
        await theme.selectOption(originalTheme);
      } catch {
        // Preserve the primary test failure if Settings became unavailable.
      }
    }
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
