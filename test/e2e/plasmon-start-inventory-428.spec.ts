import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#428 — packaged Start omits managed Settings and Properties while keeping Explorer", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #428; this gate exercises the real packaged Start adapter",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #428 Start inventory semantics",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #428 Start inventory semantics",
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
    const start = plasmon.getByRole("button", { name: "Start", exact: true });
    const panel = plasmon.getByRole("region", { name: "Start menu" });

    await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    await start.click();
    await expect(panel).toBeVisible();
    await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });

    const startItems = panel.locator("[data-start-item]");
    await expect(startItems.filter({ hasText: "Files" })).toBeVisible({ timeout: 30_000 });
    const itemNames = await startItems.locator("strong").allTextContents();
    // `native:explorer` is the Explorer application identity; its current
    // product-facing native-app name is `Files`.
    expect(itemNames).toContain("Files");
    expect(itemNames).not.toContain("Settings");
    expect(itemNames).not.toContain("Properties");
    expect(itemNames).toContain("Accessories");

    // Settings remains intentionally reachable through the Shell-owned footer
    // affordance; only the managed filesystem-backed Start shortcut is retired.
    await expect(panel.getByRole("button", { name: "Settings", exact: true })).toBeVisible();

    // Ordinary managed application inventory remains available under the same
    // Accessories category rather than being moved or replaced by #428.
    const accessories = startItems.filter({ hasText: "Accessories" });
    await accessories.click();
    await expect(panel.locator("[data-start-item]")).not.toHaveCount(0);
    await panel.getByRole("button", { name: "← Back" }).click();

    // Explorer (`native:explorer`, displayed as Files) remains an intended Start
    // application, and activation must use the real packaged filesystem-backed
    // Start/open path.
    const explorer = panel.locator("[data-start-item]").filter({ hasText: "Files" });
    await explorer.click();
    await expect(plasmon.getByLabel("File Explorer")).toBeVisible({ timeout: 10_000 });

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
