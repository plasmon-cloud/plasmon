import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const APP_READY_TIMEOUT_MS = 10_000;
const COMPOSITIONS = [
  ["light", "Graphite", "plasmon-graphite", "Glacier Prism", "glacier-prism"],
  ["dark", "Glacier", "plasmon-glacier", "Midnight Orbit", "midnight-orbit"],
] as const;

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

test("desktop label renders its explicit contrast treatment over representative light and dark packaged wallpapers", async ({ page }, testInfo) => {
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
    await page.locator(appSelector).waitFor({ state: "attached", timeout: APP_READY_TIMEOUT_MS });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    const wallpaper = app.locator(".plasmon-shell__wallpaper");
    const desktop = app.locator(".plasmon-desktop");
    const entry = app.locator(".fm-entry--desktop:not(.is-renaming)").first();
    const label = entry.locator(".fm-entry__name");

    await expect(shell).toHaveAttribute("aria-busy", "false", { timeout: APP_READY_TIMEOUT_MS });
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible();

    await app.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Settings", exact: true }).last();
    await expect(settings).toBeVisible({ timeout: 20_000 });
    await settings.getByRole("button", { name: "Personalization", exact: true }).click();
    await expect(settings.getByRole("heading", { name: "Personalization", exact: true })).toBeVisible();

    for (const [name, themeLabel, themeId, wallpaperLabel, wallpaperId] of COMPOSITIONS) {
      await settings.getByRole("button", { name: wallpaperLabel, exact: true }).click();
      await expect(shell).toHaveAttribute("data-plasmon-wallpaper", wallpaperId);
      await settings.getByRole("button", { name: themeLabel, exact: true }).click();
      await expect(shell).toHaveAttribute("data-plasmon-theme", themeId);
      await expect(shell).toHaveAttribute("data-plasmon-wallpaper", wallpaperId);

      await expect(wallpaper).toBeVisible();
      await expect(desktop).toBeVisible();
      expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage))
        .toContain(`${wallpaperId}.svg`);
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

      await testInfo.attach(`desktop-label-${name}.png`, {
        body: await entry.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    }

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