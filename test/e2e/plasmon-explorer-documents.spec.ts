import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function openPlasmon(page: Page): Promise<FrameLocator> {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();
  const selector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(selector).first()).toBeVisible();
  const app = page.frameLocator(selector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return app;
}

test("Explorer activates the standard Documents directory", async ({ page }) => {
  test.setTimeout(120_000);
  const app = await openPlasmon(page);
  const desktop = app.getByRole("region", { name: "Desktop" });
  const rootShortcut = desktop.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 20_000 });

  // Select before activation so the real FileManager keyboard boundary is used
  // even when the Desktop entry is covered by the Explorer window.
  await rootShortcut.click();
  await expect(rootShortcut).toHaveAttribute("aria-selected", "true");
  await desktop.getByRole("listbox", { name: "Files" }).press("Enter");

  const explorer = app.locator(".explorer-app").last();
  await expect(explorer).toBeVisible({ timeout: 20_000 });
  const address = explorer.getByRole("textbox", { name: "Address" });
  await expect(address).toHaveValue("/");

  const documents = explorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
  await expect(documents).toBeVisible({ timeout: 20_000 });
  await documents.click();
  await expect(documents).toHaveAttribute("aria-selected", "true");
  await explorer.getByRole("listbox", { name: "Files" }).press("Enter");
  await expect(address).toHaveValue("/Documents", { timeout: 20_000 });

  // Create the observed resource in the destination, proving that the
  // directory is live and user-editable.
  const fileName = `Explorer Documents ${Date.now()}.txt`;
  await chooseFileManagerBackgroundAction(
    explorer.getByRole("listbox", { name: "Files" }),
    "New Text Document",
  );
  const rename = explorer.locator('textarea[aria-label^="Rename New Text Document"]').last();
  await expect(rename).toBeVisible();
  await rename.fill(fileName);
  await rename.press("Enter");
  await expect(explorer.locator("[data-fm-node-id]", { hasText: fileName }).first()).toBeVisible({ timeout: 20_000 });
});
