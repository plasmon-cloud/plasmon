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
  const desktop = app.getByRole("region", { name: "Desktop" });
  const root = desktop.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(root).toBeVisible({ timeout: 30_000 });
  const windows = app.locator(".plasmon-window-layer [data-window-id]");
  const before = await windows.count();
  await root.dblclick();
  await expect(windows).toHaveCount(before + 1, { timeout: 20_000 });
  const explorer = windows.last();
  await expect(explorer.getByRole("region", { name: "File Explorer" })).toBeVisible();
  await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/");
  return explorer;
}

async function openRootDirectory(explorer: Locator, name: string): Promise<void> {
  const files = explorer.getByRole("listbox", { name: "Files" });
  const directory = files.locator('[data-fm-node-id][data-fm-kind="directory"]', { hasText: name }).first();
  await expect(directory).toBeVisible({ timeout: 20_000 });
  await directory.dblclick();
  await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue(`/${name}`, { timeout: 20_000 });
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
    let explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Apps");
    const appsFiles = explorer.getByRole("listbox", { name: "Files" });
    const reviewProjection = appsFiles.locator("[data-fm-node-id]", { hasText: "Review" }).first();
    await expect(reviewProjection).toBeVisible({ timeout: 20_000 });
    await reviewProjection.dblclick();

    const reviewSelector = 'iframe[data-app-id="review"][data-tile-id="review"]';
    await expect(page.locator(reviewSelector).last()).toBeVisible({ timeout: 15_000 });
    const review = page.frameLocator(reviewSelector).last();
    await expect(review.getByRole("region", { name: "Current Review workspace" })).toBeVisible({ timeout: 10_000 });

    // Re-open Root rather than typing into Explorer's display-only address field.
    // The real FileManager navigation boundary is canonical directory activation.
    explorer = await openExplorer(app);
    await openRootDirectory(explorer, "Desktop");
    const chooser = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…" }).click();
    const filename = `issue-107-download-${Date.now()}.txt`;
    const expected = Buffer.from("Issue #107 browser download acceptance\n");
    await (await chooser).setFiles({ name: filename, mimeType: "text/plain", buffer: expected });

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

    await app.getByRole("button", { name: "Search" }).click();
    const search = app.getByLabel("Search Plasmon");
    await search.fill("Recycle Bin");
    const result = app.locator("[data-search-result]", { hasText: "Recycle Bin" }).first();
    await expect(result).toBeVisible();
    await result.click();

    const recycleBin = app.getByRole("dialog", { name: "Recycle Bin" });
    await expect(recycleBin).toBeVisible({ timeout: 10_000 });
    await expect(recycleBin.locator("[role='row']", { hasText: restoreName }).first()).toBeVisible({ timeout: 20_000 });
    await expect(recycleBin.locator("[role='row']", { hasText: deleteName }).first()).toBeVisible();

    await recycleBin.getByRole("checkbox", { name: `Select ${restoreName}` }).check();
    await recycleBin.getByRole("button", { name: "Restore (1)" }).click();
    await expect(recycleBin.locator("[role='row']", { hasText: restoreName })).toHaveCount(0, { timeout: 20_000 });
    await expect(restoreSource.files.locator("[data-fm-node-id]", { hasText: restoreName }).first()).toBeVisible({ timeout: 20_000 });

    await recycleBin.getByRole("checkbox", { name: `Select ${deleteName}` }).check();
    await recycleBin.getByRole("button", { name: "Delete permanently (1)" }).click();
    const confirmation = recycleBin.getByRole("alertdialog", { name: "Delete permanently?" });
    await expect(confirmation).toContainText("Permanently delete 1 item?");
    await confirmation.getByRole("button", { name: "Confirm permanent delete" }).click();
    await expect(recycleBin.locator("[role='row']", { hasText: deleteName })).toHaveCount(0, { timeout: 20_000 });
    await expect(deleteSource.files.locator("[data-fm-node-id]", { hasText: deleteName })).toHaveCount(0);

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
    const chooser = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…" }).click();
    const filename = `issue-107-unsupported-${Date.now()}.webm`;
    await (await chooser).setFiles({
      name: filename,
      mimeType: "video/webm",
      buffer: Buffer.from("not-a-video"),
    });

    const entry = explorer.getByRole("listbox", { name: "Files" }).locator("[data-fm-node-id]", { hasText: filename }).first();
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await entry.dblclick();

    const player = app.getByRole("region", { name: "Video player" });
    await expect(player).toBeVisible({ timeout: 15_000 });
    const alert = player.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(filename);
    await expect(alert).toContainText(/native media codecs|could not decode/i);

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
