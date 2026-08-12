import { fileURLToPath } from "node:url";
import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { resolveLocalNeutronRuntime } from "neutron-provision/src/local_session.ts";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";

const deploymentConfig = process.env.NEUTRON_NDEPLOY_CONFIG ?? fileURLToPath(new URL("../../../review-local.ndeploy.json", import.meta.url));

export type ReviewHarness = { page: Page; review: FrameLocator; frame: Locator };

export async function login(page: Page): Promise<void> {
  const runtime = resolveLocalNeutronRuntime({ configPath: deploymentConfig });
  await page.goto(kernelUrl(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => typeof (window as typeof window & { __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: unknown }).__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  await page.evaluate(async (identitySeed) => {
    const signIn = (window as typeof window & { __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string> }).__NEUTRON_PLAYWRIGHT_LOGIN_AS__;
    if (!signIn) throw new Error("Local Playwright login is unavailable");
    await signIn(identitySeed);
  }, runtime.developerIdentitySeed);
  await expect(page.locator('[data-tid="auth-error"]')).toHaveCount(0);
  await expect(page.locator('[data-tid="app-background-frame"][data-app-id="review"]')).toHaveCount(1);
  await expect(page.locator('[data-tid="app-background-frame"][data-app-id="files"]')).toHaveCount(1);
  await page.frameLocator('[data-tid="app-background-frame"][data-app-id="review"]').locator("body").waitFor({ state: "attached" });
}

export async function openReview(page: Page): Promise<ReviewHarness> {
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator('[data-tid="launcher-tile-review-review"]').click();
  const selector = 'iframe[data-app-id="review"][data-tile-id="review"]';
  const frame = page.locator(selector).last();
  const review = page.frameLocator(selector).last();
  await expect(frame).toBeVisible({ timeout: 1_500 });
  await expect(review.locator("#root > .review-app")).toBeVisible({ timeout: 1_500 });
  await expect(review.getByText("Review.neutron", { exact: true })).toBeVisible({ timeout: 1_500 });
  return { page, review, frame };
}

export async function approveFilesTool(page: Page, tool: "readBinary" | "writeBinary"): Promise<void> {
  const dialog = page.locator('[data-tid="frontend-tool-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("review/background");
  await expect(dialog).toContainText("app:files:background");
  await expect(dialog).toContainText(tool);
  await page.locator('[data-tid="frontend-tool-approve-session"]').click();
  await expect(dialog).toHaveCount(0);
}

function kernelUrl(): string {
  const runtime = resolveLocalNeutronRuntime({ configPath: deploymentConfig });
  return localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
}
