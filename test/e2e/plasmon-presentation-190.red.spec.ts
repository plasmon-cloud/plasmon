import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#190 RED — packaged shared Plasmon assets load from the installed package mount", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  const failed: string[] = [];
  page.on("requestfailed", (request) => {
    if (/\/static\/plasmon\/icons\//u.test(new URL(request.url()).pathname)) failed.push(request.url());
  });
  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    await page.locator('[data-tid="launcher-open"]').click();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
    const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(selector)).toBeVisible();
    const plasmon = page.frameLocator(selector);
    await expect(plasmon.getByRole("listbox", { name: "Files" }).first()).toBeVisible({ timeout: 30_000 });
    const icon = plasmon.locator('img[src*="/static/plasmon/icons/"]').first();
    await expect(icon).toBeVisible();
    const src = await icon.getAttribute("src");
    expect(src, "shared asset must use the installed Plasmon package mount").toMatch(/^\/app\/plasmon\/static\/plasmon\/icons\//u);
    expect(failed, "first-party shared icon requests must not fail").toEqual([]);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global { interface Window { __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>; } }
