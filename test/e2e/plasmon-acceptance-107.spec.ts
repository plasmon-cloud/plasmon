import { readFile } from "node:fs/promises";
import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_SELECTOR = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';

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

async function openExplorer(app: FrameLocator): Promise<Locator> {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Files");
  const result = search.locator("[data-search-result]", { hasText: "Files" }).first();
  await expect(result).toBeVisible();
  await result.click();

  const explorer = app.locator(".explorer-app").last();
  await expect(explorer).toBeVisible({ timeout: 20_000 });
  await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/");
  return explorer;
}

async function navigateExplorer(explorer: Locator, path: string): Promise<void> {
  const address = explorer.getByRole("textbox", { name: "Address" });
  await address.fill(path);
  await address.press("Enter");
  await expect(address).toHaveValue(path, { timeout: 20_000 });
}

async function openRootDirectory(explorer: Locator, name: string): Promise<void> {
  await navigateExplorer(explorer, `/${name}`);
}

async function importFiles(page: Page, explorer: Locator) {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  const chooser = page.waitForEvent("filechooser");
  await toolbar.getByRole("button", { name: "Import Files…", exact: true }).click();
  return chooser;
}

async function createTextDocument(explorer: Locator, name: string) {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  await toolbar.getByRole("button", { name: "New Text Document", exact: true }).click();
  const rename = files.getByRole("textbox", { name: /^Rename New Text Document/ }).last();
  await expect(rename).toBeVisible();
  await rename.fill(name);
  await rename.press("Enter");
  const entry = files.locator("[data-fm-node-id]", { hasText: name }).first();
  await expect(entry).toBeVisible();
  return { files, toolbar, entry };
}

async function deleteEntry(toolbar: Locator, entry: Locator): Promise<void> {
  await entry.click();
  await expect(entry).toHaveAttribute("aria-selected", "true");
  await toolbar.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(entry).toHaveCount(0, { timeout: 20_000 });
}

async function openRecycleBin(app: FrameLocator): Promise<Locator> {
  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  await taskbar.getByRole("button", { name: "Search", exact: true }).click();
  const search = app.getByLabel("Search Plasmon");
  await search.fill("Recycle Bin");
  const result = app.locator("[data-search-result]", { hasText: "Recycle Bin" }).first();
  await expect(result).toBeVisible();
  await result.click();
  const recycleBin = app.getByRole("dialog", { name: "Recycle Bin" });
  await expect(recycleBin).toBeVisible({ timeout: 10_000 });
  return recycleBin;
}

async function closeNativeWindowContaining(app: FrameLocator, content: Locator): Promise<void> {
  const nativeWindow = app.locator(".plasmon-window-layer [data-window-id]").filter({ has: content }).last();
  await expect(nativeWindow).toBeVisible();
  await nativeWindow.getByRole("button", { name: "Close", exact: true }).click();
  await expect(content).toHaveCount(0, { timeout: 10_000 });
}

async function permanentlyDeleteEntry(app: FrameLocator, explorer: Locator, entry: Locator, name: string): Promise<void> {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  await deleteEntry(toolbar, entry);

  const recycleBin = await openRecycleBin(app);
  const row = recycleBin.locator("[role='row']", { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await recycleBin.getByRole("checkbox", { name: `Select ${name}` }).check();
  await recycleBin.getByRole("button", { name: "Delete permanently (1)" }).click();
  const confirmation = recycleBin.getByRole("alertdialog", { name: "Delete permanently?" });
  await expect(confirmation).toContainText("Permanently delete 1 item?");
  await confirmation.getByRole("button", { name: "Confirm permanent delete" }).click();
  await expect(row).toHaveCount(0, { timeout: 20_000 });
  await closeNativeWindowContaining(app, recycleBin);
}

test("#107 packaged Search dismisses on an outside workspace click without launching a result", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await windows.count();
    await app.getByRole("button", { name: "Search" }).click();
    const panel = app.getByRole("region", { name: "Search" });
    const input = app.getByRole("textbox", { name: "Search Plasmon" });
    await expect(panel).toBeVisible();
    await expect(input).toBeFocused();
    await input.fill("Recycle Bin");
    await expect(app.locator("[data-search-result]", { hasText: "Recycle Bin" }).first()).toBeVisible();

    const workspace = app.locator(".plasmon-shell__workspace").first();
    const bounds = await workspace.boundingBox();
    if (!bounds) throw new Error("Packaged Shell workspace has no browser geometry");
    await workspace.click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);
    await expect(windows).toHaveCount(initialWindowCount);

    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("#107 directly activates installed /Apps/Review.neutron and produces a browser-owned FileManager download", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);

    await openRootDirectory(explorer, "Desktop");
    const chooser = await importFiles(page, explorer);
    const filename = `issue-107-download-${Date.now()}.txt`;
    const expected = Buffer.from("Issue #107 browser download acceptance\n");
    await chooser.setFiles({ name: filename, mimeType: "text/plain", buffer: expected });

    const files = explorer.getByRole("listbox", { name: "Files" });
    const entry = files.locator("[data-fm-node-id]", { hasText: filename }).first();
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await entry.click({ button: "right" });
    const menu = app.getByRole("menu").last();
    await expect(menu.getByRole("menuitem", { name: "Download" })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await menu.getByRole("menuitem", { name: "Download" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Browser download did not expose a completed local file");
    expect(await readFile(downloadPath)).toEqual(expected);
    await permanentlyDeleteEntry(app, explorer, entry, filename);

    await openRootDirectory(explorer, "Apps");
    const appsFiles = explorer.getByRole("listbox", { name: "Files" });
    const reviewProjection = appsFiles.locator("[data-fm-node-id]", { hasText: "Review.neutron" }).first();
    await expect(reviewProjection).toBeVisible({ timeout: 20_000 });
    await expect(reviewProjection.locator(".fm-entry__name")).toHaveText("Review.neutron");

    const reviewSelector = 'iframe[data-app-id="review"][data-tile-id="review"]';
    const reviewFrames = page.locator(reviewSelector);
    const beforeReviewFrames = await reviewFrames.count();
    await reviewProjection.dblclick();
    await expect(reviewFrames).toHaveCount(beforeReviewFrames + 1, { timeout: 15_000 });
    const review = page.frameLocator(reviewSelector).last();
    await expect(review.getByRole("region", { name: "Current Review workspace" })).toBeVisible({ timeout: 10_000 });

    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("#107 visible Recycle Bin lifecycle restores one item and permanently deletes another", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Desktop");
    const suffix = Date.now();
    const restoreName = `Issue 107 Restore ${suffix}.txt`;
    const deleteName = `Issue 107 Permanent ${suffix}.txt`;

    const restoreSource = await createTextDocument(explorer, restoreName);
    await deleteEntry(restoreSource.toolbar, restoreSource.entry);
    const deleteSource = await createTextDocument(explorer, deleteName);
    await deleteEntry(deleteSource.toolbar, deleteSource.entry);

    const recycleBin = await openRecycleBin(app);
    await expect(recycleBin.locator("[role='row']", { hasText: restoreName }).first()).toBeVisible({ timeout: 20_000 });
    await expect(recycleBin.locator("[role='row']", { hasText: deleteName }).first()).toBeVisible();

    await recycleBin.getByRole("checkbox", { name: `Select ${restoreName}` }).check();
    await recycleBin.getByRole("button", { name: "Restore (1)" }).click();
    await expect(recycleBin.locator("[role='row']", { hasText: restoreName })).toHaveCount(0, { timeout: 20_000 });

    await recycleBin.getByRole("checkbox", { name: `Select ${deleteName}` }).check();
    await recycleBin.getByRole("button", { name: "Delete permanently (1)" }).click();
    const confirmation = recycleBin.getByRole("alertdialog", { name: "Delete permanently?" });
    await expect(confirmation).toContainText("Permanently delete 1 item?");
    await confirmation.getByRole("button", { name: "Confirm permanent delete" }).click();
    await expect(recycleBin.locator("[role='row']", { hasText: deleteName })).toHaveCount(0, { timeout: 20_000 });
    await closeNativeWindowContaining(app, recycleBin);

    // Re-enter the source directory through Explorer navigation so this contract
    // proves persisted restore/delete results without requiring cross-window live refresh.
    await navigateExplorer(explorer, "/");
    await openRootDirectory(explorer, "Desktop");
    const refreshedFiles = explorer.getByRole("listbox", { name: "Files" });
    const restoredEntry = refreshedFiles.locator("[data-fm-node-id]", { hasText: restoreName }).first();
    await expect(restoredEntry).toBeVisible({ timeout: 20_000 });
    await expect(refreshedFiles.locator("[data-fm-node-id]", { hasText: deleteName })).toHaveCount(0);

    await permanentlyDeleteEntry(app, explorer, restoredEntry, restoreName);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("#107 installed Video surfaces actionable native-codec failure for an invalid video", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Desktop");
    const chooser = await importFiles(page, explorer);
    const filename = `issue-107-unsupported-${Date.now()}.webm`;
    await chooser.setFiles({
      name: filename,
      mimeType: "video/webm",
      buffer: Buffer.from("not-a-video"),
    });

    const entry = explorer.getByRole("listbox", { name: "Files" }).locator("[data-fm-node-id]", { hasText: filename }).first();
    await expect(entry).toBeVisible({ timeout: 20_000 });
    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const beforeVideoWindows = await nativeWindows.count();
    await entry.dblclick();
    await expect(nativeWindows).toHaveCount(beforeVideoWindows + 1, { timeout: 15_000 });

    const videoWindow = nativeWindows.last();
    const player = videoWindow.getByRole("region", { name: "Video player" });
    await expect(player).toBeVisible({ timeout: 15_000 });
    const alert = player.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(filename);
    await expect(alert).toContainText(/native media codecs|could not decode/i);

    await videoWindow.getByRole("button", { name: "Close", exact: true }).click();
    await expect(nativeWindows).toHaveCount(beforeVideoWindows, { timeout: 10_000 });
    await permanentlyDeleteEntry(app, explorer, entry, filename);
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
