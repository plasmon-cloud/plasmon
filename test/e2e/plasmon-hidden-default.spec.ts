import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { activateLocalPlaywrightIdentity } from "./local-playwright-identity.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const PLASMON_FRAME = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';

async function openPlasmon(page: Page): Promise<FrameLocator> {
  const frame = page.locator(PLASMON_FRAME).first();
  if (await frame.count() === 0) {
    const launcher = page.locator('[data-tid="launcher"]');
    if (!await launcher.isVisible()) await page.locator('[data-tid="launcher-open"]').click();
    await expect(launcher).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  }
  await expect(frame).toBeVisible({ timeout: 30_000 });
  const plasmon = page.frameLocator(PLASMON_FRAME).first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return plasmon;
}

async function searchFor(plasmon: FrameLocator, query: string) {
  await plasmon.getByRole("button", { name: "Search" }).click();
  const search = plasmon.getByRole("region", { name: "Search" });
  await expect(search).toBeVisible();
  const input = search.getByRole("textbox", { name: "Search Plasmon" });
  await input.fill(query);
  const searching = search.getByRole("status").filter({ hasText: "Searching…" });
  await expect(searching).toBeVisible({ timeout: 5_000 });
  await expect(searching).toHaveCount(0, { timeout: 20_000 });
  return { search, input };
}

test("hidden Properties stays out of Search and Start while contextual Properties remains available", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await activateLocalPlaywrightIdentity(
      page,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );
    const plasmon = await openPlasmon(page);

    const { search, input } = await searchFor(plasmon, "Properties");
    await expect(search.getByRole("alert")).toHaveCount(0);
    await expect(search.locator("[data-search-result]", { hasText: "Properties" })).toHaveCount(0);
    await input.press("Escape");

    await plasmon.getByRole("button", { name: "Start", exact: true }).click();
    const start = plasmon.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });
    await expect(start.getByText("Properties", { exact: true })).toHaveCount(0);
    await start.getByRole("textbox", { name: "Search Start" }).press("Escape");

    const desktop = plasmon.locator(".fm-root--desktop").first();
    await expect(desktop).toBeVisible();
    const bounds = await desktop.boundingBox();
    if (!bounds) throw new Error("Desktop FileManager has no browser bounds");
    await desktop.click({
      button: "right",
      position: {
        x: Math.max(140, Math.floor(bounds.width * 0.62)),
        y: Math.max(140, Math.floor(bounds.height * 0.62)),
      },
    });
    await clickNewContextMenuItem(plasmon, "New Text Document");
    const rename = plasmon.getByRole("textbox", { name: "Rename New Text Document.txt" });
    await expect(rename).toBeVisible();
    await rename.fill("Visibility 466.txt");
    await rename.press("Enter");

    const item = desktop.locator("[data-fm-node-id]", { hasText: "Visibility 466.txt" }).first();
    await expect(item).toBeVisible({ timeout: 20_000 });
    await item.click({ button: "right" });
    const itemMenu = plasmon.getByRole("menu").last();
    await expect(itemMenu.getByRole("menuitem", { name: "Properties", exact: true })).toBeVisible();
    await itemMenu.getByRole("menuitem", { name: "Properties", exact: true }).click();

    const properties = plasmon.locator(
      '.fm-properties[aria-label="Properties for Visibility 466.txt"]',
    );
    await expect(properties).toBeVisible({ timeout: 20_000 });
    await expect(properties).toContainText("Visibility 466.txt");
    await expect(properties).toContainText("text/plain");

    health.assertClean();
  } finally {
    health.dispose();
  }
});
