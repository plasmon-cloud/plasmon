import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

const THEME_WALLPAPERS = [
  ["Graphite", "plasmon-graphite", "graphite-sand", "jpg"],
  ["Verdant", "plasmon-verdant", "plasmon-lattice", "generated"],
  ["Midnight", "plasmon-midnight", "midnight-orbit", "generated"],
  ["Ember", "plasmon-ember", "ember-horizon", "generated"],
  ["Glacier", "plasmon-glacier", "glacier-prism", "generated"],
  ["Rosewood", "plasmon-rosewood", "rosewood-bloom", "generated"],
] as const;

const JPG_WALLPAPER_ID = "graphite-sand";
const JPG_WALLPAPER_ASSET = "/app/plasmon/static/plasmon/wallpapers/graphite-sand.jpg";
const WALLPAPER_ASSETS = [
  [JPG_WALLPAPER_ASSET, "image/jpeg"],
  ["/app/plasmon/static/plasmon/wallpapers/plasmon-lattice.svg", "image/svg+xml"],
  ["/app/plasmon/static/plasmon/wallpapers/midnight-orbit.svg", "image/svg+xml"],
  ["/app/plasmon/static/plasmon/wallpapers/ember-horizon.svg", "image/svg+xml"],
  ["/app/plasmon/static/plasmon/wallpapers/glacier-prism.svg", "image/svg+xml"],
  ["/app/plasmon/static/plasmon/wallpapers/rosewood-bloom.svg", "image/svg+xml"],
] as const;
const WATERMARK_ASSET = "/app/plasmon/static/plasmon/plasmon-watermark.svg";
const WALLPAPER_PATH_BY_ID: Readonly<Record<string, string>> = Object.freeze({
  "graphite-sand": JPG_WALLPAPER_ASSET,
  "plasmon-lattice": "/app/plasmon/static/plasmon/wallpapers/plasmon-lattice.svg",
  "midnight-orbit": "/app/plasmon/static/plasmon/wallpapers/midnight-orbit.svg",
  "ember-horizon": "/app/plasmon/static/plasmon/wallpapers/ember-horizon.svg",
  "glacier-prism": "/app/plasmon/static/plasmon/wallpapers/glacier-prism.svg",
  "rosewood-bloom": "/app/plasmon/static/plasmon/wallpapers/rosewood-bloom.svg",
});
const WALLPAPER_LABEL_BY_ID: Readonly<Record<string, string>> = Object.freeze({
  "graphite-sand": "Graphite Sand",
  "plasmon-lattice": "Plasmon Lattice",
  "midnight-orbit": "Midnight Orbit",
  "ember-horizon": "Ember Horizon",
  "glacier-prism": "Glacier Prism",
  "rosewood-bloom": "Rosewood Bloom",
});
const PACKAGED_ASSET_PATHS = new Set([
  ...WALLPAPER_ASSETS.map(([path]) => path),
  WATERMARK_ASSET,
]);

test("six wallpapers are visible, follow themes, pin independently, and share a toggleable SVG watermark", async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  const loadedPackagedAssets = new Set<string>();
  const onResponse = (response: { url(): string; ok(): boolean }): void => {
    const path = new URL(response.url()).pathname;
    if (response.ok() && PACKAGED_ASSET_PATHS.has(path)) loadedPackagedAssets.add(path);
  };
  page.on("response", onResponse);

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
    await expect.poll(() => [...WALLPAPER_ASSETS].every(([path]) => loadedPackagedAssets.has(path))).toBe(true);

    await expect.poll(async () => desktop.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}`;
    })).toBe("rgba(0, 0, 0, 0)|none");

    await expect(shell).toHaveAttribute("data-plasmon-brand-watermark", "visible");
    const watermark = await shell.evaluate(async (element, assetPath) => {
      const style = getComputedStyle(element, "::after");
      const image = new Image();
      image.src = new URL(assetPath, document.baseURI).href;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`watermark failed to load: ${image.src}`));
      });
      await image.decode();
      return {
        opacity: Number(style.opacity),
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        content: style.content,
        height: style.height,
        right: style.right,
        width: style.width,
        zIndex: style.zIndex,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
    }, WATERMARK_ASSET);
    expect(watermark.opacity).toBeGreaterThanOrEqual(0.2);
    expect(watermark.backgroundImage).toContain("plasmon-watermark.svg");
    expect(watermark.backgroundSize).toContain("contain");
    expect(watermark.content).not.toBe("none");
    expect(Number.parseFloat(watermark.height)).toBeGreaterThan(0);
    expect(watermark.right).not.toBe("auto");
    expect(Number.parseFloat(watermark.width)).toBeGreaterThan(0);
    expect(Number(watermark.zIndex)).toBeGreaterThan(0);
    expect(watermark.naturalWidth).toBeGreaterThan(0);
    expect(watermark.naturalHeight).toBeGreaterThan(0);

    for (const [assetPath, contentType] of WALLPAPER_ASSETS) {
      const response = await request.get(new URL(assetPath, kernelUrl).toString());
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"] ?? "").toContain(contentType);
      const body = await response.body();
      if (assetPath === JPG_WALLPAPER_ASSET) {
        expect(body.byteLength).toBe(63_590);
      } else {
        expect(body.toString("utf8")).toContain("<svg");
      }
    }
    const watermarkResponse = await request.get(new URL(WATERMARK_ASSET, kernelUrl).toString());
    expect(watermarkResponse.ok()).toBe(true);
    expect(watermarkResponse.headers()["content-type"] ?? "").toContain("image/svg+xml");
    expect((await watermarkResponse.body()).toString("utf8")).toContain("<svg");

    await app.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Settings" }).last();
    await expect(settings).toBeVisible({ timeout: 20_000 });

    const watermarkToggle = settings.getByRole("button", { name: "Show Plasmon watermark", exact: true });
    await expect(watermarkToggle).toHaveAttribute("aria-pressed", "true");
    await watermarkToggle.click();
    await expect(watermarkToggle).toHaveAttribute("aria-pressed", "false");
    await expect(shell).toHaveAttribute("data-plasmon-brand-watermark", "hidden");
    expect(await shell.evaluate((element) => getComputedStyle(element, "::after").backgroundImage)).toBe("none");
    await watermarkToggle.click();
    await expect(watermarkToggle).toHaveAttribute("aria-pressed", "true");
    await expect(shell).toHaveAttribute("data-plasmon-brand-watermark", "visible");

    const follow = settings.getByRole("button", { name: "Follow theme", exact: true });
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await expect(follow).toBeEnabled();
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "rosewood-bloom");
    await follow.click();
    await expect(follow).toHaveAttribute("aria-pressed", "true");
    await expect(follow).toBeDisabled();
    await expect(settings.getByRole("button", { name: "Graphite Sand", exact: true })).toBeDisabled();

    const generatedBackgrounds = new Set<string>();
    for (const [themeLabel, themeId, wallpaperId, kind] of THEME_WALLPAPERS) {
      await settings.getByRole("button", { name: themeLabel, exact: true }).click();
      await expect(shell).toHaveAttribute("data-plasmon-theme", themeId);
      await expect(shell).toHaveAttribute("data-plasmon-wallpaper", wallpaperId);
      await expect(settings.getByRole("button", { name: WALLPAPER_LABEL_BY_ID[wallpaperId], exact: true })).toBeDisabled();
      const rendered = await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(rendered).not.toBe("none");
      const decoded = await wallpaper.evaluate(async (element, assetPath) => {
        const image = new Image();
        image.src = new URL(assetPath, document.baseURI).href;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`wallpaper failed to load: ${image.src}`));
        });
        await image.decode();
        return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
      }, WALLPAPER_PATH_BY_ID[wallpaperId]);
      expect(decoded.naturalWidth).toBeGreaterThan(0);
      expect(decoded.naturalHeight).toBeGreaterThan(0);
      if (kind === "jpg") {
        expect(rendered).toContain("graphite-sand.jpg");
        expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundSize)).toContain("cover");
      } else {
        expect(rendered).toContain(`${wallpaperId}.svg`);
        expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundSize)).toContain("cover");
        generatedBackgrounds.add(rendered);
      }
      expect(await desktop.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe("rgba(0, 0, 0, 0)");
      await testInfo.attach(`wallpaper-${themeId}.png`, {
        body: await page.locator(appSelector).screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    }
    expect(generatedBackgrounds.size).toBe(5);
    await expect.poll(() => [...PACKAGED_ASSET_PATHS].every((path) => loadedPackagedAssets.has(path))).toBe(true);

    const pinned = settings.getByRole("button", { name: "Graphite Sand", exact: true });
    await pinned.click();
    await expect(pinned).toHaveAttribute("aria-pressed", "true");
    await expect(pinned).toBeDisabled();
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", JPG_WALLPAPER_ID);
    const pinnedBackground = await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(pinnedBackground).toContain("graphite-sand.jpg");

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
    await expect(follow).toBeDisabled();
    await expect(pinned).toHaveAttribute("aria-pressed", "false");
    await expect(settings.getByRole("button", { name: "Midnight Orbit", exact: true })).toBeDisabled();
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "midnight-orbit");
    expect(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe(pinnedBackground);

    health.assertClean();
  } finally {
    page.off("response", onResponse);
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
