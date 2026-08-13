import { createHash } from "node:crypto";
import { expect, test, type Locator, type TestInfo } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function captureStableRegion(locator: Locator, label: string, testInfo: TestInfo): Promise<string> {
  await expect(locator).toBeVisible();
  const options = { animations: "disabled" as const, caret: "hide" as const };
  const first = await locator.screenshot(options);
  const second = await locator.screenshot(options);
  expect(Buffer.compare(first, second), `${label} should be pixel-stable across repeated captures`).toBe(0);
  const hash = createHash("sha256").update(first).digest("hex");
  console.log(`[visual-spike] ${label} sha256=${hash}`);
  await testInfo.attach(`${label}.png`, { body: first, contentType: "image/png" });
  return hash;
}

test("visual regression feasibility uses focused stable regions", async ({ page }, testInfo) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    const desktop = app.getByRole("listbox", { name: "Files" }).first();
    await expect(desktop).toBeVisible({ timeout: 30_000 });

    const createDesktopItem = async (
      menuItem: "New Folder" | "New Text Document",
      generatedName: string,
      finalName: string,
    ) => {
      const box = await desktop.boundingBox();
      if (!box) throw new Error("Desktop has no bounds");
      await desktop.click({
        button: "right",
        position: { x: Math.floor(box.width * 0.6), y: Math.floor(box.height * 0.55) },
      });
      await app.getByRole("menu").last().getByRole("menuitem", { name: menuItem }).click();
      const rename = app.getByRole("textbox", { name: new RegExp(`^Rename ${generatedName}`) }).first();
      await expect(rename).toBeVisible();
      await rename.fill(finalName);
      await rename.press("Enter");
      const item = app.getByRole("option", { name: finalName });
      await expect(item).toBeVisible();
      return item;
    };

    await createDesktopItem("New Folder", "New Folder", "Visual Folder");
    const visualFile = await createDesktopItem(
      "New Text Document",
      "New Text Document.txt",
      "Visual File.txt",
    );
    await visualFile.click({ button: "right" });
    await app.getByRole("menu").last().getByRole("menuitem", { name: "Create Shortcut" }).click();
    await expect(app.getByRole("option", { name: /Visual File\.txt/ })).toHaveCount(2);

    await captureStableRegion(desktop, "desktop-resource-state", testInfo);

    await visualFile.click();
    await desktop.press("F2");
    const rename = app.getByRole("textbox", { name: "Rename Visual File.txt" });
    await captureStableRegion(rename, "desktop-rename-state", testInfo);
    await rename.press("Escape");

    await app.getByRole("button", { name: "Search" }).click();
    const search = app.getByRole("region", { name: "Search" });
    await app.getByLabel("Search Plasmon").fill("Settings");
    await expect(app.locator("[data-search-result]", { hasText: "Settings" }).first()).toBeVisible();
    await captureStableRegion(search, "search-results-state", testInfo);
    await app.locator("[data-search-result]", { hasText: "Settings" }).first().click();

    const settings = app.getByRole("dialog", { name: "Settings" }).last();
    await captureStableRegion(settings, "native-window-state", testInfo);

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
