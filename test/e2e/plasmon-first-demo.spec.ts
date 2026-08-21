import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("demo deployment exposes first-demo files and Desktop shortcuts through installed Plasmon", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appFrameSelector).first()).toBeAttached();
  const app = page.frameLocator(appFrameSelector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  const activeAppUrl = new URL(await app.locator("html").evaluate(() => window.location.href));
  expect(activeAppUrl.searchParams.get("plasmon-fixture")).toBeNull();

  const desktopNotes = app.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first();
  const desktopGuide = app.locator("[data-fm-node-id]", { hasText: "First Demo Guide.md" }).first();
  const desktopArtwork = app.locator("[data-fm-node-id]", { hasText: "First Demo Artwork.svg" }).first();
  await expect(desktopNotes).toBeVisible({ timeout: 30_000 });
  await expect(desktopGuide).toBeVisible();
  await expect(desktopArtwork).toBeVisible();

  await desktopNotes.dblclick();
  const textWindow = app.getByRole("dialog", { name: "First Demo Notes.txt" }).last();
  await expect(textWindow).toBeVisible({ timeout: 20_000 });
  await expect(textWindow.getByLabel("Text editor")).toBeVisible();

  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await rootShortcut.dblclick();
  const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
  await rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();

  const documentsExplorer = app.getByRole("dialog", { name: "Documents" }).last();
  await expect(documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first()).toBeVisible();
  await expect(documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Guide.md" }).first()).toBeVisible();

  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByLabel("Search Plasmon");
  await search.fill("First Demo Guide");
  await expect(app.locator("[data-search-result]", { hasText: "First Demo Guide.md" }).first()).toBeVisible({ timeout: 15_000 });

  await search.fill("First Demo Artwork");
  const artworkResult = app.locator("[data-search-result]", { hasText: "First Demo Artwork.svg" }).first();
  await expect(artworkResult).toBeVisible({ timeout: 15_000 });
  await artworkResult.click();
  const photosWindow = app.getByRole("dialog", { name: "First Demo Artwork.svg" }).last();
  await expect(photosWindow.getByLabel("Photos")).toBeVisible({ timeout: 20_000 });
  const artwork = photosWindow.getByRole("img", { name: "First Demo Artwork.svg" });
  await expect(artwork).toBeVisible();
  const artworkBounds = await artwork.boundingBox();
  expect(artworkBounds?.width ?? 0).toBeGreaterThan(0);
  expect(artworkBounds?.height ?? 0).toBeGreaterThan(0);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
