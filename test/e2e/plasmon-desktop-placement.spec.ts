import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

/**
 * #192 keeps allocation/reconciliation policy in pure Bun coverage. This real
 * browser gate proves only the adapter fact: a packaged Desktop FileEntry is
 * rendered at the authoritative left/top position supplied by that policy.
 */
test("— packaged Desktop renders authoritative placement offsets", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #192; the gate still exercises the real packaged Desktop adapter",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside Desktop placement",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside Desktop placement",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const plasmonSelector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(plasmonSelector)).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector);
    const files = plasmon.getByRole("listbox", { name: "Files" }).first();
    await expect(files).toBeVisible({ timeout: 30_000 });

    const entries = files.locator(".fm-entries");
    const entry = entries.locator("[data-fm-node-id]").first();
    await expect(entry).toBeVisible();

    const authoritative = await entry.evaluate((element) => {
      const html = element as HTMLElement;
      return {
        left: Number.parseFloat(html.style.left),
        top: Number.parseFloat(html.style.top),
      };
    });
    expect(Number.isFinite(authoritative.left)).toBe(true);
    expect(Number.isFinite(authoritative.top)).toBe(true);

    const filesBounds = await files.boundingBox();
    const entriesBounds = await entries.boundingBox();
    const entryBounds = await entry.boundingBox();
    if (!filesBounds || !entriesBounds || !entryBounds) {
      throw new Error("Desktop placement adapter has no browser geometry");
    }

    expect(Math.abs((entryBounds.x - entriesBounds.x) - authoritative.left), "rendered left follows controller output")
      .toBeLessThanOrEqual(1);
    expect(Math.abs((entryBounds.y - entriesBounds.y) - authoritative.top), "rendered top follows controller output")
      .toBeLessThanOrEqual(1);
    expect(entryBounds.x, "entry left remains inside Desktop").toBeGreaterThanOrEqual(filesBounds.x - 1);
    expect(entryBounds.y, "entry top remains inside Desktop").toBeGreaterThanOrEqual(filesBounds.y - 1);
    expect(entryBounds.x + entryBounds.width, "entry right remains inside Desktop")
      .toBeLessThanOrEqual(filesBounds.x + filesBounds.width + 1);
    expect(entryBounds.y + entryBounds.height, "entry bottom remains inside Desktop")
      .toBeLessThanOrEqual(filesBounds.y + filesBounds.height + 1);

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
