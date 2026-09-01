import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";

test("— packaged non-empty Recycle Bin confirms and empties canonical Trash", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const plasmonSelector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(plasmonSelector)).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector);
    await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

    // Create the test-owned Trash entry through File Explorer's deterministic
    // command surface. The Desktop background context-menu hit point is not part
    // of this empty-bin acceptance and can race desktop layout/readiness in packaged CI.
    await plasmon.getByRole("button", { name: "Search" }).click();
    const search = plasmon.getByRole("region", { name: "Search" });
    await search.getByRole("textbox", { name: "Search Plasmon" }).fill("File Explorer");
    const filesResult = search.locator("[data-search-result]", { hasText: "File Explorer" }).first();
    await expect(filesResult).toBeVisible();
    await filesResult.click();

    const explorer = plasmon.getByRole("region", { name: "File Explorer" });
    await expect(explorer).toBeVisible();
    const files = explorer.getByRole("listbox", { name: "Files" });
    await expect(files).toBeVisible();
    const toolbar = files.getByRole("toolbar", { name: "File commands" });
    await expect(toolbar).toBeVisible();

    await chooseFileManagerBackgroundAction(files, "New Text Document");
    const rename = files.getByRole("textbox", { name: /^Rename New Text Document/ }).last();
    await expect(rename).toBeVisible();
    const itemName = `Recycle Bin Empty ${Date.now()}.txt`;
    await rename.fill(itemName);
    await rename.press("Enter");

    const source = files.locator("[data-fm-node-id]", { hasText: itemName }).first();
    await expect(source).toBeVisible();
    await source.click();
    await expect(source).toHaveAttribute("aria-selected", "true");
    await toolbar.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(source).toHaveCount(0, { timeout: 20_000 });

    await plasmon.getByRole("button", { name: "Search" }).click();
    const recycleSearch = plasmon.getByLabel("Search Plasmon");
    await expect(recycleSearch).toBeVisible();
    await recycleSearch.fill("Recycle Bin");
    const recycleResult = plasmon.locator("[data-search-result]", { hasText: "Recycle Bin" }).first();
    await expect(recycleResult).toBeVisible({ timeout: 15_000 });
    await recycleResult.click();

    const recycleBin = plasmon.getByRole("dialog", { name: "Recycle Bin" });
    await expect(recycleBin).toBeVisible({ timeout: 10_000 });
    const trashedEntry = recycleBin.locator("[role='row']", { hasText: itemName }).first();
    await expect(trashedEntry).toBeVisible({ timeout: 20_000 });

    const emptyButton = recycleBin.getByRole("button", { name: "Empty Recycle Bin" });
    await expect(emptyButton).toBeEnabled();
    await emptyButton.click();

    const confirmation = recycleBin.getByRole("alertdialog", { name: "Empty Recycle Bin?" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("Permanently delete all 1 item in Recycle Bin?");
    await confirmation.getByRole("button", { name: "Confirm Empty Recycle Bin" }).click();

    await expect(recycleBin.getByText("Recycle Bin is empty.")).toBeVisible({ timeout: 20_000 });
    await expect(trashedEntry).toHaveCount(0);
    await expect(recycleBin.getByRole("button", { name: "Empty Recycle Bin" })).toBeDisabled();
    health.assertClean();
  } finally {
    health.dispose();
  }
});
