import { fileURLToPath } from "node:url";
import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { resolveLocalNeutronRuntime } from "neutron-provision/src/local_session.ts";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";

const deploymentConfig = process.env.NEUTRON_NDEPLOY_CONFIG ?? fileURLToPath(new URL("../../../review-local.ndeploy.json", import.meta.url));

export type ReviewHarness = { page: Page; review: FrameLocator; frame: Locator };

export async function login(page: Page): Promise<void> {
  const runtime = resolveLocalNeutronRuntime({ configPath: deploymentConfig });
  await page.goto(kernelUrl(), { waitUntil: "domcontentloaded" });
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
  await expect(frame).toBeVisible();
  await expect(review.getByText("Review.neutron", { exact: true })).toBeVisible();
  return { page, review, frame };
}

export async function callReviewTool(page: Page, name: string, args: Record<string, unknown>, timeoutMs = 20_000): Promise<any> {
  return page.evaluate(({ name, args, timeoutMs }) => new Promise((resolve, reject) => {
    const frame = document.querySelector<HTMLIFrameElement>('[data-tid="app-background-frame"][data-app-id="review"]');
    if (!frame?.contentWindow) { reject(new Error("Review background frame is unavailable")); return; }
    const id = Date.now() + Math.floor(Math.random() * 100_000);
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`Review tool ${name} timed out`));
    }, timeoutMs);
    function onMessage(event: MessageEvent): void {
      if (event.source !== frame!.contentWindow) return;
      const response = event.data as { type?: unknown; id?: unknown; ok?: unknown; error?: unknown };
      if (response.type !== "response" || response.id !== id) return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      if (Object.hasOwn(response, "error")) reject(new Error(JSON.stringify(response.error)));
      else resolve(response.ok);
    }
    window.addEventListener("message", onMessage);
    frame.contentWindow.postMessage({ type: "exec", id, payload: { action: "__neutron_msgbus_tools_call", payload: { name, arguments: args } } }, "*");
  }), { name, args, timeoutMs });
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
