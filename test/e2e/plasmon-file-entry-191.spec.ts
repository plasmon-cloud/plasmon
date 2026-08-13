import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

/**
 * Adopted from Luna TDD-A's #191 browser RED gate as production regression
 * coverage. It consumes #187's browser-health ledger and canonical packaged
 * Plasmon environment; it does not create a component harness.
 */
test("#191 — Desktop rename editor stays bounded by its FileEntry tile", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    // Reuse the exact current packaged-baseline exceptions already owned by
    // the shared #187 smoke. These are independently tracked and do not relax
    // any #191 geometry assertion.
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #191; the gate still exercises the real packaged FileEntry",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190; installed Plasmon assets live under /app/plasmon/static/plasmon/icons/",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Same tracked product URL-resolution defect #190; aborted icon requests are a consequence of the wrong Kernel-root path",
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
    await expect(plasmon.getByRole("listbox", { name: "Files" }).first()).toBeVisible();

    const files = plasmon.getByRole("listbox", { name: "Files" }).first();
    const filesBounds = await files.boundingBox();
    if (!filesBounds) throw new Error("Desktop FileManager has no browser bounds");

    await files.click({
      button: "right",
      position: {
        x: Math.max(120, Math.floor(filesBounds.width * 0.55)),
        y: Math.max(120, Math.floor(filesBounds.height * 0.55)),
      },
    });
    await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();

    const rename = plasmon.getByRole("textbox", { name: "Rename New Text Document.txt" });
    await expect(rename).toBeVisible();
    const entry = rename.locator("xpath=ancestor::div[@data-fm-node-id][1]");
    const entryBounds = await entry.boundingBox();
    const renameBounds = await rename.boundingBox();
    if (!entryBounds || !renameBounds) throw new Error("Desktop FileEntry rename state has no browser bounds");

    expect(renameBounds.x, "rename left edge").toBeGreaterThanOrEqual(entryBounds.x - 1);
    expect(renameBounds.x + renameBounds.width, "rename right edge")
      .toBeLessThanOrEqual(entryBounds.x + entryBounds.width + 1);
    expect(renameBounds.width, "rename width")
      .toBeLessThanOrEqual(entryBounds.width + 2);

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
