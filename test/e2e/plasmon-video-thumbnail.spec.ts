import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const FIXTURE = resolve(process.cwd(), "test/e2e/fixtures/video-thumbnail.webm");

test("packaged FileManager extracts a bounded silent video frame and falls back on decode failure", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside this video-thumbnail gate; it exercises the real packaged FileManager video-thumbnail path",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(selector)).toBeVisible();
    const app = page.frameLocator(selector);
    const windows = app.locator(".plasmon-window-layer").first().locator("[data-window-id]");
    const initialWindowCount = await windows.count();
    const rootShortcut = app.getByRole("region", { name: "Desktop" }).locator("[data-fm-node-id]", { hasText: "Root" });
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    await expect(windows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

    const explorer = windows.last();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/", { timeout: 20_000 });

    const chooser = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…" }).click();
    await (await chooser).setFiles(FIXTURE);

    const supported = explorer.locator("[data-fm-node-id]", { hasText: "video-thumbnail.webm" }).first();
    await expect(supported).toBeVisible({ timeout: 30_000 });
    await supported.scrollIntoViewIfNeeded();
    const thumbnail = supported.locator(".fm-entry__icon--video .plasmon-icon-frame--thumbnail img.plasmon-media-thumbnail");
    await expect(thumbnail).toBeVisible({ timeout: 20_000 });
    await expect(thumbnail).toHaveJSProperty("complete", true);
    expect(await thumbnail.evaluate((image: HTMLImageElement) => ({
      width: image.naturalWidth,
      height: image.naturalHeight,
      src: image.currentSrc || image.src,
      objectFit: getComputedStyle(image).objectFit,
    }))).toMatchObject({ width: 160, height: 90, objectFit: "contain" });
    expect(await thumbnail.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);

    const brokenChooser = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…" }).click();
    await (await brokenChooser).setFiles({
      name: "video-thumbnail-broken.webm",
      mimeType: "video/webm",
      buffer: Buffer.from("not-a-video"),
    });

    const broken = explorer.locator("[data-fm-node-id]", { hasText: "video-thumbnail-broken.webm" }).first();
    await expect(broken).toBeVisible({ timeout: 30_000 });
    await broken.scrollIntoViewIfNeeded();
    await expect(broken.locator("img.plasmon-media-thumbnail")).toHaveCount(0, { timeout: 10_000 });
    await expect(broken.locator('.fm-entry__icon--video [data-plasmon-owned-icon="file-type:video"]'))
      .toBeVisible({ timeout: 20_000 });

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
