import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const REVIEW_TILE_ID = "review";

test("Plasmon demo discovers and opens the installed Review Element", async ({ page, request }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  const registryResponse = await request.get(new URL("/system/apps.json", kernelUrl).href);
  expect(registryResponse.ok()).toBe(true);
  const registry = await registryResponse.json() as Record<string, {
    tiles?: Array<{ id?: string; path?: string }>;
  }>;
  expect(registry[PLASMON_APP_ID]?.tiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: PLASMON_TILE_ID, path: "index.html" }),
    ]),
  );
  expect(registry[REVIEW_APP_ID]?.tiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: REVIEW_TILE_ID, path: "index.html" }),
    ]),
  );

  const reviewAsset = await request.get(new URL(`/app/${REVIEW_APP_ID}/index.html`, kernelUrl).href);
  expect(reviewAsset.ok(), "Review should be served from its independently installed package").toBe(true);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

  const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
  const plasmonFrame = page.locator(plasmonSelector).first();
  await expect(plasmonFrame).toBeVisible();
  const plasmon = page.frameLocator(plasmonSelector).first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  // Search presents the Kernel-authoritative installed Review projection and
  // activates it through Plasmon's canonical filesystem/open path. Review's
  // own first-demo workflow is accepted in the standalone Review lane.
  await plasmon.getByRole("button", { name: "Search" }).click();
  const search = plasmon.getByLabel("Search Plasmon");
  await expect(search).toBeVisible();
  await search.fill("Review");
  const reviewResult = plasmon.locator("[data-search-result]", { hasText: "Review" }).first();
  await expect(reviewResult).toBeVisible({ timeout: 15_000 });
  await reviewResult.click();

  const reviewSelector = `iframe[data-app-id="${REVIEW_APP_ID}"][data-tile-id="${REVIEW_TILE_ID}"]`;
  const reviewFrame = page.locator(reviewSelector).last();
  await expect(reviewFrame).toBeVisible({ timeout: 10_000 });
  const review = page.frameLocator(reviewSelector).last();
  await expect(review.locator("#root > .review-app")).toBeVisible({ timeout: 5_000 });
  await expect(review.getByRole("region", { name: "Current Review workspace" })).toBeVisible({ timeout: 5_000 });

  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
