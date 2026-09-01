import { readFile } from "node:fs/promises";
import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { installPackagedDiagnosticArtifact } from "./plasmon-diagnostic-artifact.ts";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";

const PLASMON_SELECTOR = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
const ACTION_TIMEOUT = 5_000;

async function launchPlasmon(page: Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const diagnostics = installPackagedDiagnosticArtifact(page);
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
  return { app, health, diagnostics };
}

function nativeWindows(app: FrameLocator): Locator {
  return app.locator(".plasmon-window-layer [data-window-id]");
}

function nativeWindowById(app: FrameLocator, windowId: string): Locator {
  const escapedWindowId = windowId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return app.locator(`.plasmon-window-layer [data-window-id="${escapedWindowId}"]`);
}

async function openExplorer(app: FrameLocator): Promise<Locator> {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("File Explorer");
  const result = search.locator("[data-search-result]", { hasText: "File Explorer" }).first();
  await expect(result).toBeVisible();
  await result.click();

  const explorer = app.locator(".explorer-app").last();
  await expect(explorer).toBeVisible({ timeout: ACTION_TIMEOUT });
  await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/");
  return explorer;
}

async function navigateExplorer(explorer: Locator, path: string): Promise<void> {
  if (path !== "/") throw new Error(`Acceptance helper only supports root navigation, received ${path}`);
  const address = explorer.getByRole("textbox", { name: "Address" });
  await explorer
    .getByRole("navigation", { name: "Location breadcrumb" })
    .getByRole("button", { name: "This Plasmon", exact: true })
    .click();
  await expect(address).toHaveValue(path, { timeout: ACTION_TIMEOUT });
}

async function openRootDirectory(explorer: Locator, name: string): Promise<void> {
  const address = explorer.getByRole("textbox", { name: "Address" });
  const favorite = explorer
    .getByRole("complementary", { name: "Favorites" })
    .getByRole("button", { name, exact: true });
  await expect(favorite).toBeVisible({ timeout: ACTION_TIMEOUT });
  await favorite.click();
  await expect(address).toHaveValue(`/${name}`, { timeout: ACTION_TIMEOUT });
}

async function importFiles(page: Page, explorer: Locator) {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  const chooser = page.waitForEvent("filechooser", { timeout: ACTION_TIMEOUT });
  await toolbar.getByRole("button", { name: "Import Files…", exact: true }).click();
  return chooser;
}

async function createTextDocument(explorer: Locator, name: string) {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  await chooseFileManagerBackgroundAction(files, "New Text Document");
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
  await expect(entry).toHaveCount(0, { timeout: ACTION_TIMEOUT });
}

async function openRecycleBin(app: FrameLocator): Promise<{ recycleBin: Locator; windowId: string }> {
  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  await taskbar.getByRole("button", { name: "Search", exact: true }).click();
  const search = app.getByLabel("Search Plasmon");
  await search.fill("Recycle Bin");
  const result = app.locator("[data-search-result]", { hasText: "Recycle Bin" }).first();
  await expect(result).toBeVisible();
  await result.click();
  const recycleBin = app.getByRole("dialog", { name: "Recycle Bin" });
  // The Recycle Bin role dialog is the native-window root, so capture its
  // stable identity directly before destructive actions mutate its content.
  await expect(recycleBin).toBeVisible({ timeout: ACTION_TIMEOUT });
  const windowId = await recycleBin.getAttribute("data-window-id");
  if (!windowId) throw new Error("Recycle Bin native window has no stable data-window-id");

  return { recycleBin, windowId };
}

async function closeNativeWindowById(app: FrameLocator, windowId: string, content: Locator): Promise<void> {
  const nativeWindow = nativeWindowById(app, windowId);
  await expect(nativeWindow).toBeVisible({ timeout: ACTION_TIMEOUT });
  await nativeWindow.locator(":scope > .plasmon-window__titlebar .plasmon-window__control--close").click();
  await expect(nativeWindow).toHaveCount(0, { timeout: ACTION_TIMEOUT });
  await expect(content).toHaveCount(0, { timeout: ACTION_TIMEOUT });
}

async function permanentlyDeleteEntry(app: FrameLocator, explorer: Locator, entry: Locator, name: string): Promise<void> {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  await deleteEntry(toolbar, entry);

  const { recycleBin, windowId } = await openRecycleBin(app);
  const row = recycleBin.locator("[role='row']", { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: ACTION_TIMEOUT });
  await recycleBin.getByRole("checkbox", { name: `Select ${name}` }).check();
  await recycleBin.getByRole("button", { name: "Delete permanently (1)" }).click();
  const confirmation = recycleBin.getByRole("alertdialog", { name: "Delete permanently?" });
  await expect(confirmation).toContainText("Permanently delete 1 item?");
  await confirmation.getByRole("button", { name: "Confirm permanent delete" }).click();
  await expect(row).toHaveCount(0, { timeout: ACTION_TIMEOUT });
  await closeNativeWindowById(app, windowId, recycleBin);
}

test("packaged Search dismisses on an outside workspace click without launching a result", async ({ page }, testInfo) => {
  const { app, health, diagnostics } = await launchPlasmon(page);
  try {
    const windows = nativeWindows(app);
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
  } catch (error) {
    await diagnostics.attach(testInfo);
    throw error;
  } finally {
    diagnostics.dispose();
    health.dispose();
  }
});

test("directly activates installed /Apps/Review.neutron through FileManager", async ({ page }, testInfo) => {
  const { app, health, diagnostics } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);
    const rootFiles = explorer.getByRole("listbox", { name: "Files" });
    // Use the visible Apps shortcut so navigation and the asynchronous
    // directory listing commit through the normal FileManager path together.
    const appsShortcut = rootFiles.locator("[data-fm-node-id]", { hasText: "Apps" }).first();
    await expect(appsShortcut).toBeVisible({ timeout: ACTION_TIMEOUT });
    await appsShortcut.dblclick();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/Apps", {
      timeout: ACTION_TIMEOUT,
    });
    const appsFiles = explorer.getByRole("listbox", { name: "Files" });
    const reviewProjection = appsFiles.locator("[data-fm-node-id]", { hasText: "Review.neutron" }).first();
    await expect(reviewProjection).toBeVisible({ timeout: ACTION_TIMEOUT });
    await expect(reviewProjection.locator(".fm-entry__name")).toHaveText("Review.neutron");

    const reviewSelector = 'iframe[data-app-id="review"][data-tile-id="review"]';
    const reviewFrames = page.locator(reviewSelector);
    const beforeReviewFrames = await reviewFrames.count();
    await reviewProjection.dblclick();
    await expect(reviewFrames).toHaveCount(beforeReviewFrames + 1, { timeout: ACTION_TIMEOUT });
    const review = page.frameLocator(reviewSelector).last();
    await expect(review.getByRole("region", { name: "Current Review workspace" })).toBeVisible({ timeout: ACTION_TIMEOUT });

    health.assertClean();
  } catch (error) {
    await diagnostics.attach(testInfo);
    throw error;
  } finally {
    diagnostics.dispose();
    health.dispose();
  }
});

test("FileManager Download produces browser-owned bytes", async ({ page }, testInfo) => {
  const { app, health, diagnostics } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Desktop");
    const chooser = await importFiles(page, explorer);
    const filename = `download-acceptance-${Date.now()}.txt`;
    const expected = Buffer.from("browser download acceptance\n");
    await chooser.setFiles({ name: filename, mimeType: "text/plain", buffer: expected });

    const files = explorer.getByRole("listbox", { name: "Files" });
    const entry = files.locator("[data-fm-node-id]", { hasText: filename }).first();
    await expect(entry).toBeVisible({ timeout: ACTION_TIMEOUT });
    await entry.click({ button: "right" });
    const menu = app.getByRole("menu").last();
    const downloadItem = menu.getByRole("menuitem", { name: "Download" });
    await expect(downloadItem).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: ACTION_TIMEOUT }),
      downloadItem.click(),
    ]);
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Browser download did not expose a completed local file");
    expect(await readFile(downloadPath)).toEqual(expected);
    await permanentlyDeleteEntry(app, explorer, entry, filename);

    health.assertClean();
  } catch (error) {
    await diagnostics.attach(testInfo);
    throw error;
  } finally {
    diagnostics.dispose();
    health.dispose();
  }
});

test("visible Recycle Bin lifecycle restores one item and permanently deletes another", async ({ page }, testInfo) => {
  const { app, health, diagnostics } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Desktop");
    const suffix = Date.now();
    const restoreName = `Recycle Restore ${suffix}.txt`;
    const deleteName = `Recycle Permanent ${suffix}.txt`;

    const restoreSource = await createTextDocument(explorer, restoreName);
    await deleteEntry(restoreSource.toolbar, restoreSource.entry);
    const deleteSource = await createTextDocument(explorer, deleteName);
    await deleteEntry(deleteSource.toolbar, deleteSource.entry);

    const { recycleBin, windowId } = await openRecycleBin(app);
    await expect(recycleBin.locator("[role='row']", { hasText: restoreName }).first()).toBeVisible({ timeout: ACTION_TIMEOUT });
    await expect(recycleBin.locator("[role='row']", { hasText: deleteName }).first()).toBeVisible();

    await recycleBin.getByRole("checkbox", { name: `Select ${restoreName}` }).check();
    await recycleBin.getByRole("button", { name: "Restore (1)" }).click();
    await expect(recycleBin.locator("[role='row']", { hasText: restoreName })).toHaveCount(0, { timeout: ACTION_TIMEOUT });

    await recycleBin.getByRole("checkbox", { name: `Select ${deleteName}` }).check();
    await recycleBin.getByRole("button", { name: "Delete permanently (1)" }).click();
    const confirmation = recycleBin.getByRole("alertdialog", { name: "Delete permanently?" });
    await expect(confirmation).toContainText("Permanently delete 1 item?");
    await confirmation.getByRole("button", { name: "Confirm permanent delete" }).click();
    await expect(recycleBin.locator("[role='row']", { hasText: deleteName })).toHaveCount(0, { timeout: ACTION_TIMEOUT });
    await closeNativeWindowById(app, windowId, recycleBin);

    // Re-enter the source directory through Explorer navigation so this contract
    // proves persisted restore/delete results without requiring cross-window live refresh.
    await navigateExplorer(explorer, "/");
    await openRootDirectory(explorer, "Desktop");
    const refreshedFiles = explorer.getByRole("listbox", { name: "Files" });
    const restoredEntry = refreshedFiles.locator("[data-fm-node-id]", { hasText: restoreName }).first();
    await expect(restoredEntry).toBeVisible({ timeout: ACTION_TIMEOUT });
    await expect(refreshedFiles.locator("[data-fm-node-id]", { hasText: deleteName })).toHaveCount(0);

    await permanentlyDeleteEntry(app, explorer, restoredEntry, restoreName);
    health.assertClean();
  } catch (error) {
    await diagnostics.attach(testInfo);
    throw error;
  } finally {
    diagnostics.dispose();
    health.dispose();
  }
});

test("installed Video surfaces actionable native-codec failure for an invalid video", async ({ page }, testInfo) => {
  const { app, health, diagnostics } = await launchPlasmon(page);
  try {
    const explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Desktop");
    const chooser = await importFiles(page, explorer);
    const filename = `unsupported-video-${Date.now()}.webm`;
    await chooser.setFiles({
      name: filename,
      mimeType: "video/webm",
      buffer: Buffer.from("not-a-video"),
    });

    const entry = explorer.getByRole("listbox", { name: "Files" }).locator("[data-fm-node-id]", { hasText: filename }).first();
    await expect(entry).toBeVisible({ timeout: ACTION_TIMEOUT });
    const windows = nativeWindows(app);
    const beforeVideoWindows = await windows.count();
    await entry.dblclick();
    await expect(windows).toHaveCount(beforeVideoWindows + 1, { timeout: ACTION_TIMEOUT });

    const videoWindow = windows.last();
    const player = videoWindow.getByRole("region", { name: "Video player" });
    await expect(player).toBeVisible({ timeout: ACTION_TIMEOUT });
    const alert = player.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: ACTION_TIMEOUT });
    await expect(alert).toContainText(filename);
    await expect(alert).toContainText(/native media codecs|could not decode/i);

    await videoWindow.locator(":scope > .plasmon-window__titlebar .plasmon-window__control--close").click();
    await expect(windows).toHaveCount(beforeVideoWindows, { timeout: ACTION_TIMEOUT });
    await permanentlyDeleteEntry(app, explorer, entry, filename);
    health.assertClean();
  } catch (error) {
    await diagnostics.attach(testInfo);
    throw error;
  } finally {
    diagnostics.dispose();
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
