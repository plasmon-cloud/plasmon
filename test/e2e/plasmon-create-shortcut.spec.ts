import { expect, test, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

async function launchPlasmon(page: Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside this packaged FileManager command gate",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/app/plasmon/static/plasmon/icons/",
        reason: "Known product icon URL-resolution defect is outside shortcut creation",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/app/plasmon/static/plasmon/icons/",
        reason: "Known product icon URL-resolution defect is outside shortcut creation",
      },
    ],
  });

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

  const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
  await expect(page.locator(selector)).toBeVisible();
  const app = page.frameLocator(selector);
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { app, health };
}

async function openExplorer(app: ReturnType<Page["frameLocator"]>) {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("File Explorer");
  const result = search.locator("[data-search-result]", { hasText: "File Explorer" }).first();
  await expect(result).toBeVisible();
  await result.click();

  const explorer = app.getByRole("region", { name: "File Explorer" });
  await expect(explorer).toBeVisible();
  const files = explorer.getByRole("listbox", { name: "Files" });
  await expect(files).toBeVisible();
  return { explorer, files };
}

async function createFolderFromBackground(
  app: ReturnType<Page["frameLocator"]>,
  files: Locator,
) {
  // Permanent creation buttons are intentionally absent. Use the canonical
  // background creation route, accepting both flat and grouped New menu shapes
  // so this dependent acceptance remains valid across merge order.
  await files.dispatchEvent("contextmenu", {
    button: 2,
    clientX: 16,
    clientY: 16,
  });
  const backgroundMenu = app.getByRole("menu").last();
  await expect(backgroundMenu).toBeVisible();

  const newSubmenuTrigger = backgroundMenu.getByRole("menuitem", { name: "New", exact: true });
  if (await newSubmenuTrigger.count()) {
    await newSubmenuTrigger.click();
    const newSubmenu = app.getByRole("menu", { name: "New submenu" });
    await expect(newSubmenu).toBeVisible();
    await newSubmenu.getByRole("menuitem", { name: "New Folder", exact: true }).click();
    return;
  }

  await backgroundMenu.getByRole("menuitem", { name: "New Folder", exact: true }).click();
}

function nameFromRenameLabel(label: string | null): string {
  if (!label?.startsWith("Rename ")) throw new Error(`Unexpected rename label: ${String(label)}`);
  return label.slice("Rename ".length);
}

async function expectResolvedDirectoryShortcut(shortcut: Locator) {
  // Node-target shortcut presentation resolves asynchronously through the
  // authoritative target NodeId. Waiting for the folder art proves the visible
  // shortcut has completed that resolution before another filesystem command is
  // issued, instead of overlapping the presentation fs.stat with the next write.
  await expect(shortcut.locator('[data-plasmon-owned-icon="file-type:folder"]')).toBeVisible();
  await expect(shortcut.locator(".plasmon-shortcut-overlay")).toBeVisible();
}

/**
 * Deterministic coverage already owns canonical NodeId metadata, capabilities,
 * collision naming, and selection state. This packaged gate proves the remaining
 * user-visible boundary through the real toolbar/context-menu commands and
 * canonical open dispatcher.
 */
test("packaged FileManager exposes and activates Create Shortcut", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const { explorer, files } = await openExplorer(app);
    const toolbar = files.getByRole("toolbar", { name: "File commands" });
    await expect(toolbar).toBeVisible();

    // Create one ordinary folder so the acceptance owns a stable target without
    // relying on demo content or an editor/runtime-specific target.
    await createFolderFromBackground(app, files);
    const targetRename = files.getByRole("textbox", { name: /^Rename New Folder(?: \(\d+\))?$/ }).last();
    await expect(targetRename).toBeVisible();
    await expect(targetRename).toBeFocused();
    const targetName = nameFromRenameLabel(await targetRename.getAttribute("aria-label"));
    await targetRename.press("Enter");

    const target = files.locator('[data-fm-kind="directory"]', { hasText: targetName }).first();
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute("aria-selected", "true");

    // Toolbar discoverability: exactly one eligible selection enables the real
    // Create Shortcut command. Creation enters ordinary selection/rename state.
    const toolbarCreateShortcut = toolbar.getByRole("button", { name: "Create Shortcut", exact: true });
    await expect(toolbarCreateShortcut).toBeVisible();
    await expect(toolbarCreateShortcut).toBeEnabled();
    await toolbarCreateShortcut.click();

    // FileEntry renders the active rename textarea inside the resource row.
    // Anchor the packaged assertion to that descendant relationship so the
    // evidence proves this exact shortcut entry entered ordinary rename state.
    const firstRenamingShortcut = files
      .locator('[data-fm-kind="shortcut"]:has(textarea[aria-label^="Rename "])')
      .first();
    const firstRename = firstRenamingShortcut.getByRole("textbox", { name: /^Rename / });
    await expect(firstRenamingShortcut).toBeVisible();
    await expect(firstRename).toBeVisible();
    await expect(firstRename).toBeFocused();
    const firstShortcutName = nameFromRenameLabel(await firstRename.getAttribute("aria-label"));
    expect(firstShortcutName).not.toBe(targetName);
    expect(firstShortcutName.startsWith(targetName)).toBe(true);

    await expect(firstRenamingShortcut).toHaveAttribute("aria-selected", "true");
    await expectResolvedDirectoryShortcut(firstRenamingShortcut);
    const firstShortcutId = await firstRenamingShortcut.getAttribute("data-fm-node-id");
    if (!firstShortcutId) throw new Error("First packaged shortcut has no stable NodeId");
    await firstRename.press("Escape");
    const firstShortcut = files.locator(`[data-fm-node-id="${firstShortcutId}"]`);
    await expect(firstShortcut).toContainText(firstShortcutName);

    // Item-context-menu discoverability runs the same production command seam.
    // A second creation also proves canonical collision naming is visible through
    // the packaged UI rather than only through the headless helper test.
    await target.click();
    await target.click({ button: "right" });
    const menu = app.getByRole("menu").last();
    await expect(menu).toBeVisible();
    const menuCreateShortcut = menu.getByRole("menuitem", { name: "Create Shortcut", exact: true });
    await expect(menuCreateShortcut).toBeVisible();
    await expect(menuCreateShortcut).toBeEnabled();
    await menuCreateShortcut.click();

    const secondRenamingShortcut = files
      .locator('[data-fm-kind="shortcut"]:has(textarea[aria-label^="Rename "])')
      .first();
    const secondRename = secondRenamingShortcut.getByRole("textbox", { name: /^Rename / });
    await expect(secondRenamingShortcut).toBeVisible();
    await expect(secondRename).toBeVisible();
    await expect(secondRename).toBeFocused();
    const secondShortcutName = nameFromRenameLabel(await secondRename.getAttribute("aria-label"));
    expect(secondShortcutName).not.toBe(firstShortcutName);
    expect(secondShortcutName.startsWith(targetName)).toBe(true);

    await expect(secondRenamingShortcut).toHaveAttribute("aria-selected", "true");
    await expectResolvedDirectoryShortcut(secondRenamingShortcut);
    const secondShortcutId = await secondRenamingShortcut.getAttribute("data-fm-node-id");
    if (!secondShortcutId) throw new Error("Second packaged shortcut has no stable NodeId");
    await secondRename.press("Escape");
    const secondShortcut = files.locator(`[data-fm-node-id="${secondShortcutId}"]`);
    await expect(secondShortcut).toContainText(secondShortcutName);

    // Activate the first shortcut through normal FileEntry double-click. The
    // canonical dispatcher resolves it to the directory target, and Explorer's
    // production onOpenDirectory callback navigates this same process in place.
    await firstShortcut.dblclick();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue(`/${targetName}`);
    await expect(explorer.getByRole("navigation", { name: "Location breadcrumb" }).getByRole("button", { name: targetName, exact: true })).toBeVisible();
    await expect(explorer.getByRole("listbox", { name: "Files" })).toBeVisible();

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
