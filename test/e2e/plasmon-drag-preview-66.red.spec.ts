import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#66 RED — active packaged Desktop drag exposes a top-level preview above windows", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    await page.locator('[data-tid="launcher-open"]').click();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
    const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(selector)).toBeVisible();
    const plasmon = page.frameLocator(selector);
    const files = plasmon.getByRole("listbox", { name: "Files" }).first();
    await expect(files).toBeVisible({ timeout: 30_000 });
    const entry = files.getByRole("option").first();
    await expect(entry).toBeVisible();
    const box = await entry.boundingBox();
    if (!box) throw new Error("Desktop entry has no browser bounds");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 220, box.y + 150, { steps: 4 });
    const preview = plasmon.locator('[data-fm-drag-preview]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS("pointer-events", "none");
    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error("Drag preview has no browser bounds");
    expect(previewBox.y).toBeLessThan((await page.viewportSize())?.height ?? Number.MAX_SAFE_INTEGER);
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global { interface Window { __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>; } }
