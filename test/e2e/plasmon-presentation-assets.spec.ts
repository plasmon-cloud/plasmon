import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const ICON_PREFIX = `/app/${PLASMON_APP_ID}/static/plasmon/icons/`;
const REVIEW_ICON_PATH = `/app/${REVIEW_APP_ID}/static/icon.svg`;
const NATIVE_IDENTITY_ASSETS = [
  "text.svg",
  "markdown.svg",
  "photos.svg",
  "video.svg",
  "browser.svg",
  "settings.svg",
] as const;

function pathname(value: string): string {
  return new URL(value).pathname;
}

function isReviewIconUrl(value: string): boolean {
  return pathname(value).startsWith(`/app/${REVIEW_APP_ID}/static/icon.`);
}

test("#190/#96 installed assets and #171 bounded Element icon probing use canonical package resources", async ({ page }) => {
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

  let requested = [...new Set(iconRequests)];
  expect(requested.every((path) => path.startsWith(ICON_PREFIX)), `shared icon requests: ${requested.join(", ")}`).toBe(true);

  for (const name of ["file.svg", "folder.svg", "recycle-bin.svg", "shortcut-overlay.svg"] as const) {
    const path = `${ICON_PREFIX}${name}`;
    expect(requested, `${path} should be requested by the real installed surface`).toContain(path);
    await expect.poll(
      () => iconResponses.get(path),
      { timeout: 15_000, message: `${path} should load successfully` },
    ).toBe(200);
  }

  // #171: Review is an independently installed Neutron package in the canonical
  // demo deployment. Kernel apps.describe currently omits icon metadata, so the
  // one documented legacy package-local SVG compatibility path may use at most
  // the two established Neutron app origins. It must not fan out across guessed
  // extensions or repeat an identical candidate request.
  await expect.poll(
    () => reviewIconRequests.length,
    { timeout: 15_000, message: "installed Review icon should be resolved during Element discovery" },
  ).toBeGreaterThanOrEqual(1);
  expect(
    reviewIconRequests.length,
    `Review icon requests: ${reviewIconRequests.join(", ")}; responses: ${JSON.stringify(reviewIconResponses)}; failures: ${reviewIconFailures.join(", ")}`,
  ).toBeLessThanOrEqual(2);
  expect(
    new Set(reviewIconRequests).size,
    `Review icon requests must not repeat: ${reviewIconRequests.join(", ")}`,
  ).toBe(reviewIconRequests.length);
  expect(
    reviewIconRequests.every((url) => pathname(url) === REVIEW_ICON_PATH),
    `Review icon requests: ${reviewIconRequests.join(", ")}`,
  ).toBe(true);
  expect(
    reviewIconResponses.some(({ status }) => status === 200),
    `Review icon responses: ${JSON.stringify(reviewIconResponses)}`,
  ).toBe(true);
  expect(
    reviewIconFailures.length,
    `Review icon failed requests: ${reviewIconFailures.join(", ")}`,
  ).toBeLessThanOrEqual(1);

  // #96: exercise the canonical filesystem-backed Start projection rather than
  // inventing a presentation-only app catalog. Settings is a direct Start root
  // entry; the remaining five first-party apps are ordinary Accessories seeds.
  await plasmon.getByRole("button", { name: "Start" }).click();
  const start = plasmon.getByRole("region", { name: "Start menu" });
  await expect(start).toBeVisible();
  await expect(start.getByRole("button", { name: /Settings/u }).first()).toBeVisible();
  await start.getByRole("button", { name: /Accessories/u }).first().click();

  for (const name of ["Text Editor", "Markdown", "Photos", "Video Player", "Browser"] as const) {
    await expect(start.getByRole("button", { name: new RegExp(name, "u") }).first()).toBeVisible();
  }

  await expect.poll(
    () => NATIVE_IDENTITY_ASSETS.filter((name) => iconResponses.get(`${ICON_PREFIX}${name}`) === 200).length,
    { timeout: 15_000, message: "all six canonical native identity assets should load from the installed package" },
  ).toBe(NATIVE_IDENTITY_ASSETS.length);

  requested = [...new Set(iconRequests)];
  for (const name of NATIVE_IDENTITY_ASSETS) {
    const path = `${ICON_PREFIX}${name}`;
    expect(requested, `${path} should be requested by canonical Start presentation`).toContain(path);
    expect(iconResponses.get(path), `${path} should stay offline/package-local and load successfully`).toBe(200);
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
