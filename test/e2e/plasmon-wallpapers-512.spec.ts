import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

const THEME_WALLPAPERS = [
  ["Plasmon Dark", "plasmon-dark", "plasmon-lattice"],
  ["Midnight", "plasmon-midnight", "midnight-orbit"],
  ["Ember", "plasmon-ember", "ember-horizon"],
  ["Glacier", "plasmon-glacier", "glacier-prism"],
  ["Rosewood", "plasmon-rosewood", "rosewood-bloom"],
] as const;

const JPG_WALLPAPER_ID = "digital-dusk";
const JPG_WALLPAPER_ASSET = "/static/plasmon/wallpapers/digital-dusk.jpg";

test("#512 wallpapers are visible, branded, follow themes, and allow generated or JPG pinning", async ({ page }) => {
  test.setTimeout(180_000);
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
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 60_000 });
    await expect(shell).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });
    await expect(wallpaper).toBeVisible();
    await expect(desktop).toBeVisible();

    // Regression guard for the real user-visible failure: the FileManager-owned
    // desktop canvas sits above Shell wallpaper in DOM stacking order. If it
    // paints its old semantic desktop background, every selected wallpaper is
    // completely hidden even though data-plasmon-wallpaper and backgroundImage
    // on the wallpaper element are correct.
    await expect.poll(async () => desktop.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}`;
    })).toBe("rgba(0, 0, 0, 0)|none");

    const watermark = await wallpaper.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return {
        content: style.content.replace(/^['\"]|['\"]$/g, ""),
        opacity: Number(style.opacity),
        backgroundImage: style.backgroundImage,
      };
    });
    expect(watermark.content).toBe("PLASMON");
    expect(watermark.opacity).toBeGreaterThanOrEqual(0.15);
    expect(watermark.backgroundImage).toContain("plasmon-mark.svg");

    await app.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Shell settings" });
    await expect(settings).toBeVisible();

    const follow = settings.getByRole("button", { name: "Follow theme", exact: true });
    await expect(follow).toHaveAttribute("aria-pressed", "true");

    const backgrounds = new Set<string>();
    for (const [themeLabel, themeId, wallpaperId] of THEME_WALLPAPERS) {
      await settings.getByRole("button", { name: themeLabel, exact: true }).click();
      await expect(shell).toHaveAttribute("data-plasmon-theme", themeId);
      await expect(shell).toHaveAttribute("data-plasmon-wallpaper", wallpaperId);
      const rendered = await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(rendered).toContain("gradient");
      backgrounds.add(rendered);
      expect(await desktop.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe("rgba(0, 0, 0, 0)");
    }
    expect(backgrounds.size).toBe(THEME_WALLPAPERS.length);

    // The extra raster choice must be a real packaged JPEG and must use the
    // same pinned preference path as the generated backgrounds.
    const pinned = settings.getByRole("button", { name: "Digital Dusk", exact: true });
    const jpgResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith(JPG_WALLPAPER_ASSET),
      { timeout: 30_000 },
    );
    await pinned.click();
    const jpgResponse = await jpgResponsePromise;
    expect(jpgResponse.ok()).toBe(true);
    expect(jpgResponse.headers()["content-type"] ?? "").toContain("image/jpeg");
    await expect(pinned).toHaveAttribute("aria-pressed", "true");
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", JPG_WALLPAPER_ID);
    const pinnedBackground = await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(pinnedBackground).toContain("digital-dusk.jpg");
    expect(await desktop.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe("rgba(0, 0, 0, 0)");

    await settings.getByRole("button", { name: "Glacier", exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-glacier");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", JPG_WALLPAPER_ID);
    expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(pinnedBackground);

    await settings.getByRole("button", { name: "Midnight", exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-midnight");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", JPG_WALLPAPER_ID);
    expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(pinnedBackground);

    await follow.click();
    await expect(follow).toHaveAttribute("aria-pressed", "true");
    await expect(pinned).toHaveAttribute("aria-pressed", "false");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "midnight-orbit");
    expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe(pinnedBackground);
    expect(await desktop.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe("rgba(0, 0, 0, 0)");

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
