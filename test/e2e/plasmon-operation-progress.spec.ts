import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const IMPORT_BYTES = 8 * 1024 * 1024;

async function launchPlasmon(page: Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #65; this gate exercises the real packaged FileManager operation UI",
      },
    ],
  });

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

  const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
  await expect(page.locator(selector)).toBeVisible();
  const app = page.frameLocator(selector);
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { app, health };
}

async function openExplorer(app: FrameLocator) {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Files");
  const result = search.locator("[data-search-result]", { hasText: "Files" }).first();
  await expect(result).toBeVisible();
  await result.click();

  const explorer = app.getByRole("region", { name: "File Explorer" });
  await expect(explorer).toBeVisible();
  const files = explorer.getByRole("listbox", { name: "Files" });
  await expect(files).toBeVisible();
  return { explorer, files };
}

/**
 * #65 model/RTL coverage already proves success, partial failure, paste lifecycle,
 * and duplicate-trigger protection. This packaged gate owns the remaining
 * acceptance boundary: a deliberately non-trivial real import must expose the
 * production accessible running state while actual filesystem writes are live.
 */
test("— packaged FileManager exposes truthful progress during a non-trivial import", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const { explorer, files } = await openExplorer(app);
    const toolbar = files.getByRole("toolbar", { name: "File commands" });
    const importButton = toolbar.getByRole("button", { name: "Import Files…" });
    await expect(importButton).toBeEnabled();

    const input = explorer.locator('input[type="file"]').first();
    await expect(input).toHaveCount(1);
    const payloads = ["progress-a.bin", "progress-b.bin", "progress-c.bin"].map((name, index) => ({
      name,
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(IMPORT_BYTES, index + 1),
    }));

    await input.setInputFiles(payloads);

    const status = explorer.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toContainText(/Importing [123] of 3: progress-[abc]\.bin/);
    await expect(importButton).toBeDisabled();

    await expect(status).toHaveCount(0, { timeout: 60_000 });
    await expect(importButton).toBeEnabled();
    for (const payload of payloads) {
      await expect(files.locator("[data-fm-node-id]", { hasText: payload.name }).first()).toBeVisible();
    }

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
