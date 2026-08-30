import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const THEME_LABEL = "Graphite";
const THEME_ID = "plasmon-graphite";
const WALLPAPER_LABEL = "Glacier Prism";
const WALLPAPER_ID = "glacier-prism";

async function expectWallpaperLabelTreatment(label: Locator): Promise<void> {
  await expect(label).toBeVisible();
  const presentation = await label.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      color: style.color,
      textShadow: style.textShadow,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      width: box.width,
      height: box.height,
    };
  });

  expect(presentation.color).toBe("rgb(255, 255, 255)");
  expect(presentation.textShadow).not.toBe("none");
  expect(presentation.textShadow).toContain("0, 0, 0");
  expect(presentation.visibility).toBe("visible");
  expect(presentation.opacity).toBeGreaterThan(0);
  expect(presentation.width).toBeGreaterThan(0);
  expect(presentation.height).toBeGreaterThan(0);
}

test("desktop label renders with explicit contrast treatment over a representative light packaged wallpaper", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector)).toBeVisible({ timeout: 60_000 });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    const wallpaper = app.locator(".plasmon-shell__wallpaper");
    const desktop = app.locator(".plasmon-desktop");
    const label = app.locator(".fm-entry--desktop:not(.is-renaming) .fm-entry__name").first();

    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 60_000 });
    await expect(shell).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });

    await app.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Shell settings" });
    await expect(settings).toBeVisible();

    await settings.getByRole("button", { name: WALLPAPER_LABEL, exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", WALLPAPER_ID);
    await settings.getByRole("button", { name: THEME_LABEL, exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", THEME_ID);
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", WALLPAPER_ID);

    await expect(wallpaper).toBeVisible();
    await expect(desktop).toBeVisible();
    expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage))
      .toContain(`${WALLPAPER_ID}.svg`);
    expect(await desktop.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe("rgba(0, 0, 0, 0)");
    await expectWallpaperLabelTreatment(label);

    const labelBox = await label.boundingBox();
    const wallpaperBox = await wallpaper.boundingBox();
    if (!labelBox || !wallpaperBox) throw new Error("Desktop label/wallpaper composition has no browser geometry");
    expect(labelBox.x).toBeGreaterThanOrEqual(wallpaperBox.x);
    expect(labelBox.y).toBeGreaterThanOrEqual(wallpaperBox.y);
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(wallpaperBox.x + wallpaperBox.width);
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(wallpaperBox.y + wallpaperBox.height);

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
