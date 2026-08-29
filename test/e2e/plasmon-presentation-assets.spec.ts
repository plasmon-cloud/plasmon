import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const ICON_PREFIX = `/app/${PLASMON_APP_ID}/static/plasmon/icons/`;
const PACKAGED_ICON_ASSETS = [
  "file.svg",
  "folder.svg",
  "recycle-bin.svg",
  "shortcut-overlay.svg",
  "text.svg",
  "markdown.svg",
  "photos.svg",
  "video.svg",
  "browser.svg",
  "settings.svg",
] as const;

/**
 * #190 keeps the canonical icon resources package-local, but #513 deliberately
 * no longer uses those SVG files as external <img> documents for Plasmon-owned
 * artwork. The live surface must use inline owned SVG so theme custom properties
 * can reach its fills/strokes. Authored application/media artwork remains image
 * based through the separate ResourceIcon application/thumbnail paths.
 */
test("#190/#96/#513 packaged icon resources exist while live Plasmon-owned artwork is inline", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

  const selector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
  await expect(page.locator(selector).first()).toBeVisible();
  const plasmon = page.frameLocator(selector).first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  await expect(plasmon.getByRole("listbox", { name: "Files" }).first()).toBeVisible();

  // The package contract remains explicit even though these resources are now
  // reference/fallback assets rather than the live theming mechanism.
  for (const name of PACKAGED_ICON_ASSETS) {
    const response = await page.request.get(new URL(`${ICON_PREFIX}${name}`, kernelUrl).href);
    expect(response.status(), `${name} should remain package-local and available`).toBe(200);
  }

  const folder = plasmon.locator('[data-plasmon-owned-icon="file-type:folder"]').first();
  const recycleBin = plasmon.locator('[data-plasmon-owned-icon="system:recycle-bin"]').first();
  const shortcutOverlay = plasmon.locator('[data-plasmon-owned-icon="shortcut-overlay"]').first();
  await expect(folder).toBeVisible();
  await expect(recycleBin).toBeVisible();
  await expect(shortcutOverlay).toBeVisible();
  await expect(plasmon.locator('img[src*="/static/plasmon/icons/folder.svg"]')).toHaveCount(0);
  await expect(plasmon.locator('img[src*="/static/plasmon/icons/recycle-bin.svg"]')).toHaveCount(0);

  // #96: exercise the canonical filesystem-backed Start projection. Its
  // first-party identities must also use the owned inline artwork rather than
  // silently falling back to fixed-color packaged <img> elements.
  await plasmon.getByRole("button", { name: "Start" }).click();
  const start = plasmon.getByRole("region", { name: "Start menu" });
  await expect(start).toBeVisible();
  await start.getByRole("button", { name: /Accessories/u }).first().click();

  for (const name of ["Text Editor", "Markdown", "Photos", "Video Player", "Browser"] as const) {
    await expect(start.getByRole("button", { name: new RegExp(name, "u") }).first()).toBeVisible();
  }
  for (const ownedName of [
    "file-type:text",
    "file-type:markdown",
    "system:photos",
    "file-type:video",
    "system:browser",
  ] as const) {
    await expect(start.locator(`[data-plasmon-owned-icon="${ownedName}"]`).first()).toBeVisible();
  }

  await plasmon.getByRole("button", { name: "Search", exact: true }).click();
  const search = plasmon.getByRole("region", { name: "Search" });
  await expect(search).toBeVisible();
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Settings");
  const settingsResult = search.locator("[data-search-result]").filter({ hasText: "Settings" }).first();
  await expect(settingsResult).toBeVisible({ timeout: 15_000 });
  await expect(settingsResult.locator('[data-plasmon-owned-icon="system:settings"]')).toBeVisible();
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
