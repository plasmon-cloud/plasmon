import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const ICON_PREFIX = `/app/${PLASMON_APP_ID}/static/plasmon/icons/`;
const REVIEW_ICON_PATH = `/app/${REVIEW_APP_ID}/static/icon.svg`;

function pathname(value: string): string {
  return new URL(value).pathname;
}

function isReviewIconUrl(value: string): boolean {
  return pathname(value).startsWith(`/app/${REVIEW_APP_ID}/static/icon.`);
}

test("#190 installed Plasmon requests shared assets and #171 bounds installed Element icon probing", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const iconRequests: string[] = [];
  const iconResponses = new Map<string, number>();
  const reviewIconRequests: string[] = [];
  const reviewIconResponses: Array<{ url: string; status: number }> = [];
  const reviewIconFailures: string[] = [];

  page.on("request", (request) => {
    const path = pathname(request.url());
    if (path.includes("/static/plasmon/icons/")) iconRequests.push(path);
    if (isReviewIconUrl(request.url())) reviewIconRequests.push(request.url());
  });
  page.on("response", (response) => {
    const path = pathname(response.url());
    if (path.includes("/static/plasmon/icons/")) iconResponses.set(path, response.status());
    if (isReviewIconUrl(response.url())) {
      reviewIconResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on("requestfailed", (request) => {
    if (isReviewIconUrl(request.url())) reviewIconFailures.push(request.url());
  });

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

  await expect.poll(() => new Set(iconRequests).size, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);

  const requested = [...new Set(iconRequests)];
  expect(requested.every((path) => path.startsWith(ICON_PREFIX)), `shared icon requests: ${requested.join(", ")}`).toBe(true);

  for (const name of ["file.svg", "folder.svg", "recycle-bin.svg", "shortcut-overlay.svg"] as const) {
    const path = `${ICON_PREFIX}${name}`;
    expect(requested, `${path} should be requested by the real installed surface`).toContain(path);
    await expect.poll(
      () => iconResponses.get(path),
      { timeout: 15_000, message: `${path} should load successfully` },
    ).toBe(200);
  }

  // Review is an independently installed Neutron package in the canonical demo
  // deployment. Kernel apps.describe currently omits icon metadata, so one
  // documented package-local fallback may try the two established Neutron app
  // origins sequentially. A successful candidate is then consumed by the shared
  // ResourceIcon <img>; that consumer request is not another resolver probe.
  // Bound distinct candidate URLs and per-URL multiplicity so normal rendering
  // cannot be mistaken for extension/path fan-out while request storms still fail.
  await expect.poll(
    () => reviewIconRequests.length,
    { timeout: 15_000, message: "installed Review icon should be resolved during Element discovery" },
  ).toBeGreaterThanOrEqual(1);

  const distinctReviewUrls = [...new Set(reviewIconRequests)];
  expect(
    distinctReviewUrls.length,
    `Review icon candidates: ${distinctReviewUrls.join(", ")}`,
  ).toBeLessThanOrEqual(2);
  expect(
    reviewIconRequests.length,
    `Review icon requests: ${reviewIconRequests.join(", ")}`,
  ).toBeLessThanOrEqual(3);
  expect(
    distinctReviewUrls.every((url) => pathname(url) === REVIEW_ICON_PATH),
    `Review icon candidates: ${distinctReviewUrls.join(", ")}`,
  ).toBe(true);

  for (const url of distinctReviewUrls) {
    expect(
      reviewIconRequests.filter((candidate) => candidate === url).length,
      `Review icon request multiplicity for ${url}: ${reviewIconRequests.join(", ")}`,
    ).toBeLessThanOrEqual(2);
  }

  expect(
    reviewIconResponses.some(({ status }) => status === 200),
    `Review icon responses: ${JSON.stringify(reviewIconResponses)}`,
  ).toBe(true);
  expect(
    reviewIconFailures.length,
    `Review icon failed requests: ${reviewIconFailures.join(", ")}`,
  ).toBeLessThanOrEqual(1);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
