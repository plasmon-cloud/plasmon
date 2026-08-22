import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#51 — installed app can create an independent Desktop shortcut from FileManager context menu", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #51; this gate exercises the real packaged FileManager projection/shortcut path",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #51 Send to Desktop behavior",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #51 Send to Desktop behavior",
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
    const desktop = plasmon.locator(".fm-root--desktop").first();
    await expect(desktop).toBeVisible({ timeout: 30_000 });

    const desktopEntries = desktop.locator("[data-fm-node-id]");
    const beforeDesktopIds = new Set(
      (await desktopEntries.evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-fm-node-id"))))
        .filter((id): id is string => Boolean(id)),
    );
    const beforeDesktopCount = beforeDesktopIds.size;

    // Use the real seeded Apps shortcut so the source is the protected
    // filesystem projection created from independently installed Review.neutron.
    const appsShortcut = desktop.locator("[data-fm-node-id]", { hasText: "Apps" }).first();
    await expect(appsShortcut).toBeVisible();
    const windows = plasmon.locator(".plasmon-window-layer [data-window-id]");
    const beforeWindowCount = await windows.count();
    await appsShortcut.dblclick();
    await expect(windows).toHaveCount(beforeWindowCount + 1, { timeout: 20_000 });

    const explorer = plasmon.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(explorer).toHaveCount(1);
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/Apps");

    const reviewProjection = explorer.locator("[data-fm-node-id]", { hasText: "Review.neutron" }).first();
    await expect(reviewProjection).toBeVisible({ timeout: 20_000 });
    const projectionId = await reviewProjection.getAttribute("data-fm-node-id");
    if (!projectionId) throw new Error("Review.neutron projection has no stable NodeId");

    await reviewProjection.click({ button: "right" });
    const menu = explorer.getByRole("menu").last();
    const sendToDesktop = menu.getByRole("menuitem", { name: "Send to Desktop (create shortcut)" });
    await expect(sendToDesktop).toBeVisible();
    await expect(sendToDesktop).toBeEnabled();
    await sendToDesktop.click();
    await expect(menu).toHaveCount(0);

    // The command mutates only /Desktop. The protected source projection remains
    // at the same NodeId and its visible name is unchanged.
    await expect(reviewProjection).toBeVisible();
    await expect(reviewProjection).toHaveAttribute("data-fm-node-id", projectionId);
    await expect(reviewProjection).toContainText("Review.neutron");

    await expect.poll(async () => await desktopEntries.count()).toBe(beforeDesktopCount + 1);
    const afterDesktopIds = (await desktopEntries.evaluateAll((entries) =>
      entries.map((entry) => entry.getAttribute("data-fm-node-id"))))
      .filter((id): id is string => Boolean(id));
    const createdId = afterDesktopIds.find((id) => !beforeDesktopIds.has(id));
    if (!createdId) throw new Error("Send to Desktop did not create a distinct shortcut NodeId");

    const createdShortcut = desktop.locator(`[data-fm-node-id="${createdId}"]`);
    await expect(createdShortcut).toBeVisible();
    await expect(createdShortcut).toContainText("Review.neutron");

    // Close Explorer and mutate the shortcut independently through ordinary
    // FileManager rename. This must not rename the protected /Apps projection.
    await explorer.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
    await expect(explorer).toHaveCount(0, { timeout: 10_000 });

    const renamedShortcut = `Review desktop shortcut ${Date.now()}`;
    await createdShortcut.click({ button: "right" });
    const desktopMenu = plasmon.getByRole("menu").last();
    await desktopMenu.getByRole("menuitem", { name: "Rename" }).click();
    const rename = desktop.getByRole("textbox", { name: /Rename Review\.neutron/ });
    await expect(rename).toBeVisible();
    await rename.fill(renamedShortcut);
    await rename.press("Enter");
    await expect(createdShortcut).toContainText(renamedShortcut);

    await appsShortcut.dblclick();
    await expect(windows).toHaveCount(beforeWindowCount + 1, { timeout: 20_000 });
    const reopenedExplorer = plasmon.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(reopenedExplorer.getByRole("textbox", { name: "Address" })).toHaveValue("/Apps");
    const unchangedProjection = reopenedExplorer.locator(`[data-fm-node-id="${projectionId}"]`);
    await expect(unchangedProjection).toContainText("Review.neutron");
    await expect(unchangedProjection).not.toContainText(renamedShortcut);

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
