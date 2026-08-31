import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

/**
 * Packaged regression coverage for Desktop FileEntry rename geometry.
 * The active editor may grow from its content width, but its horizontal cap is
 * the owning Desktop FileEntry rather than a wider overlay. Keep this smoke
 * focused on the durable contract: rename remains local, tile-bounded, and
 * unable to change Desktop collision/placement geometry.
 */
test("Desktop rename editor stays inside its FileEntry tile", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    // Reuse the current packaged-baseline exceptions already owned by the
    // shared browser-health smoke without relaxing any rename geometry assertion.
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside this FileEntry gate; the gate still exercises the real packaged FileEntry",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect: installed Plasmon assets live under /app/plasmon/static/plasmon/icons/",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Aborted icon requests are a consequence of the tracked wrong Kernel-root asset path",
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
    await clickNewContextMenuItem(plasmon, "New Text Document");

    const rename = plasmon.getByRole("textbox", { name: "Rename New Text Document.txt" });
    await expect(rename).toBeVisible();
    const entry = rename.locator("xpath=ancestor::div[@data-fm-node-id][1]");
    const entryBounds = await entry.boundingBox();
    const renameBounds = await rename.boundingBox();
    if (!entryBounds || !renameBounds) throw new Error("Desktop FileEntry rename state has no browser bounds");

    const renameRight = renameBounds.x + renameBounds.width;
    const entryRight = entryBounds.x + entryBounds.width;

    expect(renameBounds.x, "rename stays inside Desktop workspace at left")
      .toBeGreaterThanOrEqual(filesBounds.x - 1);
    expect(renameRight, "rename stays inside Desktop workspace at right")
      .toBeLessThanOrEqual(filesBounds.x + filesBounds.width + 1);
    expect(renameBounds.x, "rename stays inside owning FileEntry at left")
      .toBeGreaterThanOrEqual(entryBounds.x - 1);
    expect(renameRight, "rename stays inside owning FileEntry at right")
      .toBeLessThanOrEqual(entryRight + 1);
    expect(renameBounds.width, "rename remains tile-bounded")
      .toBeLessThanOrEqual(entryBounds.width + 1);

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
