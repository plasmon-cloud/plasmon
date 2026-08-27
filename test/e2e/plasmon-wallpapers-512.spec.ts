import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";

const THEME_WALLPAPERS = [
  ["Plasmon Dark", "plasmon-dark", "plasmon-aurora"],
  ["Midnight", "plasmon-midnight", "midnight-orbit"],
  ["Ember", "plasmon-ember", "ember-horizon"],
  ["Glacier", "plasmon-glacier", "glacier-prism"],
  ["Rosewood", "plasmon-rosewood", "rosewood-bloom"],
] as const;

async function redirectToFirstDemo(route: Route): Promise<void> {
  const requestUrl = new URL(route.request().url());
  const appRoot = `/app/${APP_ID}/`;
  const isMainDocument = route.request().resourceType() === "document"
    && (requestUrl.pathname === appRoot || requestUrl.pathname === `${appRoot}index.html`);
  if (!isMainDocument || requestUrl.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE) {
    await route.continue();
    return;
  }
  requestUrl.searchParams.set(FIXTURE_PARAM, FIXTURE_VALUE);
  await route.fulfill({
    status: 307,
    headers: { location: requestUrl.href, "cache-control": "no-store" },
  });
}

test("#512 generated wallpapers follow themes until the user pins one", async ({ page }) => {
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

    const fixtureRoute = `**/app/${APP_ID}/**`;
    await page.route(fixtureRoute, redirectToFirstDemo);
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
    await page.unroute(fixtureRoute, redirectToFirstDemo);

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector)).toBeVisible();
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    const wallpaper = app.locator(".plasmon-shell__wallpaper");
    await expect(shell).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });

    await app.getByRole("button", { name: "Start" }).click();
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
      backgrounds.add(await wallpaper.evaluate((element) => getComputedStyle(element).backgroundImage));
    }
    expect(backgrounds.size).toBe(THEME_WALLPAPERS.length);

    const pinned = settings.getByRole("button", { name: "Ember Horizon", exact: true });
    await pinned.click();
    await expect(pinned).toHaveAttribute("aria-pressed", "true");
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "ember-horizon");

    await settings.getByRole("button", { name: "Glacier", exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-glacier");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "ember-horizon");

    await settings.getByRole("button", { name: "Midnight", exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-midnight");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "ember-horizon");

    await follow.click();
    await expect(follow).toHaveAttribute("aria-pressed", "true");
    await expect(pinned).toHaveAttribute("aria-pressed", "false");
    await expect(shell).toHaveAttribute("data-plasmon-wallpaper", "midnight-orbit");

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
