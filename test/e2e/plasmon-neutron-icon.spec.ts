import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const REVIEW_TILE_ID = "review";
const REVIEW_ICON_PATH = `/app/${REVIEW_APP_ID}/static/icon.svg`;

function pathname(value: string): string {
  return new URL(value).pathname;
}

async function expectReviewArtwork(locator: Locator): Promise<void> {
  const image = locator.locator("img.plasmon-native-app-icon");
  await expect(image).toHaveCount(1);
  const src = await image.getAttribute("src");
  expect(src, "Review should render its installed package artwork, not the generic application fallback").toBeTruthy();
  expect(pathname(src!)).toBe(REVIEW_ICON_PATH);
}

test("#390 installed Review native artwork reaches Search and taskbar through shared presentation", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    await page.locator('[data-tid="launcher-open"]').click();
    await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

    const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
    await expect(page.locator(plasmonSelector).first()).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector).first();
    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 30_000 });

    await plasmon.getByRole("button", { name: "Search" }).click();
    const search = plasmon.getByLabel("Search Plasmon");
    await expect(search).toBeVisible();
    await search.fill("Review");
    const reviewResult = plasmon.locator("[data-search-result]", { hasText: "Review" }).first();
    await expect(reviewResult).toBeVisible({ timeout: 15_000 });
    await expectReviewArtwork(reviewResult);
    await reviewResult.click();

    const reviewSelector = `iframe[data-app-id="${REVIEW_APP_ID}"][data-tile-id="${REVIEW_TILE_ID}"]`;
    await expect(page.locator(reviewSelector).last()).toBeVisible({ timeout: 10_000 });

    const reviewTask = taskbar.getByRole("button", { name: /^Review;/ }).first();
    await expect(reviewTask).toBeVisible({ timeout: 15_000 });
    await expectReviewArtwork(reviewTask);

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
