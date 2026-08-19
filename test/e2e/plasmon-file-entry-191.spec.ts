import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

/**
 * Adopted from Luna TDD-A's #191 browser RED gate as production regression
 * coverage. It consumes #187's browser-health ledger and canonical packaged
 * Plasmon environment; it does not create a component harness.
 *
 * #361 intentionally permits a compact rename overlay to overhang the 92px
 * Desktop FileEntry by a few pixels so ordinary Windows-like names fit on one
 * line. Keep this smoke focused on #191's durable contract: rename remains
 * local to its owning entry, bounded by the Desktop workspace, and compact
 * enough that it cannot become the old workspace-wide editor.
 */
test("#191/#361 — Desktop rename editor stays compact, local, and workspace-bounded", async ({ page }) => {
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

    const renameRight = renameBounds.x + renameBounds.width;
    const entryRight = entryBounds.x + entryBounds.width;
    const overlap = Math.min(renameRight, entryRight) - Math.max(renameBounds.x, entryBounds.x);

    expect(renameBounds.x, "rename stays inside Desktop workspace at left")
      .toBeGreaterThanOrEqual(filesBounds.x - 1);
    expect(renameRight, "rename stays inside Desktop workspace at right")
      .toBeLessThanOrEqual(filesBounds.x + filesBounds.width + 1);
    expect(renameBounds.width, "rename remains a compact local overlay")
      .toBeLessThanOrEqual(entryBounds.width + 24);
    expect(overlap, "rename remains horizontally anchored to its owning FileEntry")
      .toBeGreaterThan(0);

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
