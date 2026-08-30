import { readFile } from "node:fs/promises";
import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_SELECTOR = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
const ACTION_TIMEOUT = 5_000;
const SURFACE_TIMEOUT = 20_000;

async function launchPlasmon(page: Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  await expect(page.locator(PLASMON_SELECTOR).first()).toBeVisible();
  const app = page.frameLocator(PLASMON_SELECTOR).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { app, health };
}

async function openDesktop(app: FrameLocator): Promise<Locator> {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Files");
  const result = search.locator("[data-search-result]", { hasText: "Files" }).first();
  await expect(result).toBeVisible();
  await result.click();

  const explorer = app.locator(".explorer-app").last();
  await expect(explorer).toBeVisible({ timeout: ACTION_TIMEOUT });
  const favorite = explorer
    .getByRole("complementary", { name: "Favorites" })
    .getByRole("button", { name: "Desktop", exact: true });
  await expect(favorite).toBeVisible({ timeout: SURFACE_TIMEOUT });
  await favorite.click();
  await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/Desktop", {
    timeout: SURFACE_TIMEOUT,
  });
  return explorer;
}

async function importFile(page: Page, explorer: Locator, filename: string, content: Buffer): Promise<Locator> {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  const chooser = page.waitForEvent("filechooser", { timeout: ACTION_TIMEOUT });
  await toolbar.getByRole("button", { name: "Import Files…", exact: true }).click();
  await (await chooser).setFiles({ name: filename, mimeType: "text/plain", buffer: content });
  const entry = files.locator("[data-fm-node-id]", { hasText: filename }).first();
  await expect(entry).toBeVisible({ timeout: SURFACE_TIMEOUT });
  return entry;
}

async function removeFile(explorer: Locator, entry: Locator): Promise<void> {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  await entry.click();
  await toolbar.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(entry).toHaveCount(0, { timeout: ACTION_TIMEOUT });
}

async function openDownloadMenu(entry: Locator, app: FrameLocator): Promise<Locator> {
  await entry.click({ button: "right" });
  const menu = app.getByRole("menu").last();
  const download = menu.getByRole("menuitem", { name: "Download" });
  await expect(download).toBeVisible();
  await expect(download).toBeEnabled({ timeout: SURFACE_TIMEOUT });
  return download;
}

test("packaged supported hosted download produces browser-owned bytes", async ({ page }) => {
  test.skip(process.env.PLASMON_PACKAGE_PROFILE === "core", "The core profile runs the compatibility scenario instead");
  const { app, health } = await launchPlasmon(page);
  try {
    const explorer = await openDesktop(app);
    const filename = `download-supported-${Date.now()}.txt`;
    const expected = Buffer.from("supported hosted download\n");
    const entry = await importFile(page, explorer, filename, expected);
    const downloadItem = await openDownloadMenu(entry, app);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: ACTION_TIMEOUT }),
      downloadItem.click(),
    ]);
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Browser download did not expose a completed local file");
    expect(await readFile(downloadPath)).toEqual(expected);
    await removeFile(explorer, entry);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("packaged core hosted download surfaces an actionable compatibility ErrorBanner", async ({ page }) => {
  test.skip(process.env.PLASMON_PACKAGE_PROFILE !== "core", "Only the core profile runs the compatibility scenario");
  const { app, health } = await launchPlasmon(page);
  try {
    const explorer = await openDesktop(app);
    const filename = `download-legacy-${Date.now()}.txt`;
    const entry = await importFile(page, explorer, filename, Buffer.from("legacy hosted download\n"));
    const downloadItem = await openDownloadMenu(entry, app);
    await downloadItem.click();

    const error = app.locator(".fm-error-banner").first();
    await expect(error).toBeVisible({ timeout: ACTION_TIMEOUT });
    await expect(error).toContainText("Downloads are unavailable in this hosted Neutron runtime");
    await expect(error).toContainText("Use a Kernel with installed-app download support");
    await removeFile(explorer, entry);
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
