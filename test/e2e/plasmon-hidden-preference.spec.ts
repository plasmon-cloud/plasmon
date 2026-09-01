import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { activateLocalPlaywrightIdentity } from "./local-playwright-identity.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const PLASMON_FRAME = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;

async function openPlasmon(page: Page): Promise<FrameLocator> {
  const frame = page.locator(PLASMON_FRAME).first();
  if (await frame.count() === 0) {
    const launcher = page.locator('[data-tid="launcher"]');
    if (!await launcher.isVisible()) await page.locator('[data-tid="launcher-open"]').click();
    await expect(launcher).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();
  }

  await expect(frame).toBeVisible({ timeout: 30_000 });
  const app = page.frameLocator(PLASMON_FRAME).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return app;
}

function locationBreadcrumb(explorer: Locator): Locator {
  return explorer.getByRole("navigation", { name: "Location breadcrumb" });
}

async function openRootExplorer(app: FrameLocator): Promise<Locator> {
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();

  const explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(explorer).toBeVisible({ timeout: 20_000 });
  const breadcrumb = locationBreadcrumb(explorer);
  await expect(breadcrumb.getByRole("button", { name: "This Plasmon", exact: true })).toBeVisible();
  await expect(breadcrumb.getByRole("button")).toHaveCount(1);
  return explorer;
}

async function openFileManagerBackgroundMenu(explorer: Locator): Promise<Locator> {
  const files = explorer.getByRole("listbox", { name: "Files" });
  await expect(files).toBeVisible();
  const position = await files.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const maxY = Math.min(rect.height - 16, Math.max(48, rect.height * 0.4));
    for (let y = 24; y <= maxY; y += 16) {
      for (let x = Math.max(16, rect.width - 16); x >= 16; x -= 16) {
        const hit = document.elementFromPoint(rect.left + x, rect.top + y);
        if (!(hit instanceof Element) || !element.contains(hit)) continue;
        if (hit.closest(
          "[data-fm-node-id], button, input, textarea, select, a, [role='button'], [role='menuitem']",
        )) continue;
        return { x, y };
      }
    }
    return null;
  });
  if (!position) throw new Error("Explorer FileManager has no exposed background point for its context menu");

  await files.click({ button: "right", position });
  const menu = explorer.getByRole("menu", { name: "Folder background context menu" });
  await expect(menu).toBeVisible();
  return explorer;
}

function hiddenEntry(explorer: Locator, name: string): Locator {
  return explorer.locator("[data-fm-node-id]", { hasText: name }).first();
}

async function setShowHiddenFiles(explorer: Locator, checked: boolean): Promise<void> {
  const checkbox = explorer.getByRole("checkbox", { name: "Show hidden files" });
  await expect(checkbox).toBeVisible();
  if (await checkbox.isChecked() !== checked) {
    if (checked) await checkbox.check();
    else await checkbox.uncheck();
  }
  await expect(checkbox).toBeChecked({ checked });
}

test("packaged Explorer persists Show hidden files through reopen and reload", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  const hiddenName = `.hidden-preference-${Date.now()}`;

  try {
    await page.goto(kernelUrl);
    await activateLocalPlaywrightIdentity(
      page,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );

    let app = await openPlasmon(page);
    let explorer = await openRootExplorer(app);

    // Make retries independent of any preference value left by an earlier
    // attempt. This uses the rendered control and therefore persists through
    // the same FsService-backed preference authority under test.
    await setShowHiddenFiles(explorer, false);

    const menuScope = await openFileManagerBackgroundMenu(explorer);
    await clickNewContextMenuItem(menuScope, "New Folder");
    const rename = explorer.getByRole("textbox", { name: /^Rename New Folder(?: \(\d+\))?$/ }).last();
    await expect(rename).toBeVisible();
    await rename.fill(hiddenName);
    await rename.press("Enter");
    await expect(rename).toHaveCount(0);

    // The filesystem owns dot-hidden classification. With the presentation
    // preference disabled, the newly renamed canonical hidden resource is not
    // listed; enabling the UI preference must reveal that same resource.
    await expect(hiddenEntry(explorer, hiddenName)).toHaveCount(0);
    await setShowHiddenFiles(explorer, true);
    const revealed = hiddenEntry(explorer, hiddenName);
    await expect(revealed).toBeVisible();
    const nodeId = await revealed.getAttribute("data-fm-node-id");
    if (!nodeId) throw new Error("Hidden folder has no stable NodeId");

    await setShowHiddenFiles(explorer, false);
    await expect(hiddenEntry(explorer, hiddenName)).toHaveCount(0);
    await setShowHiddenFiles(explorer, true);
    await expect(hiddenEntry(explorer, hiddenName)).toHaveAttribute("data-fm-node-id", nodeId);

    // Showing a hidden location affects presentation only. Navigate through the
    // normal FileManager activation path, then reacquire the native dialog after
    // Windowing updates its title to the current directory name. Assert the
    // rendered breadcrumb rather than the responsive address editor, which may
    // be visually hidden at the packaged viewport.
    await hiddenEntry(explorer, hiddenName).dblclick();
    explorer = app.getByRole("dialog", { name: hiddenName }).last();
    await expect(explorer).toBeVisible({ timeout: 20_000 });
    let breadcrumb = locationBreadcrumb(explorer);
    await expect(breadcrumb.getByRole("button", { name: hiddenName, exact: true })).toBeVisible();
    await expect(breadcrumb.getByRole("button", { name: "This Plasmon", exact: true })).toBeVisible();
    await setShowHiddenFiles(explorer, false);
    await expect(breadcrumb.getByRole("button", { name: hiddenName, exact: true })).toBeVisible();

    // Persist the enabled preference for the reopen/reload boundaries below.
    await setShowHiddenFiles(explorer, true);
    await explorer.getByRole("button", { name: "Up one level" }).click();
    explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(explorer).toBeVisible({ timeout: 20_000 });
    breadcrumb = locationBreadcrumb(explorer);
    await expect(breadcrumb.getByRole("button", { name: "This Plasmon", exact: true })).toBeVisible();
    await expect(breadcrumb.getByRole("button")).toHaveCount(1);
    await expect(hiddenEntry(explorer, hiddenName)).toHaveAttribute("data-fm-node-id", nodeId);

    await explorer.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
    await expect(explorer).toHaveCount(0);

    explorer = await openRootExplorer(app);
    await expect(explorer.getByRole("checkbox", { name: "Show hidden files" })).toBeChecked();
    await expect(hiddenEntry(explorer, hiddenName)).toHaveAttribute("data-fm-node-id", nodeId);

    // A top-level Kernel reload recreates the foreground Plasmon composition.
    // The preference and filesystem identity must be reconstructed from the
    // persistent FsService authority rather than foreground browser storage.
    await page.reload({ waitUntil: "domcontentloaded" });
    await activateLocalPlaywrightIdentity(
      page,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );
    app = await openPlasmon(page);
    explorer = await openRootExplorer(app);
    await expect(explorer.getByRole("checkbox", { name: "Show hidden files" })).toBeChecked();
    await expect(hiddenEntry(explorer, hiddenName)).toHaveAttribute("data-fm-node-id", nodeId);

    health.assertClean();
  } finally {
    health.dispose();
  }
});
