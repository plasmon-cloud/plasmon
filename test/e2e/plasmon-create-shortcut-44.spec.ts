import { expect, test, type Page } from "@playwright/test";
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
        reason: "Kernel-owned installed-app iframe warning is outside #44; this gate exercises the real packaged FileManager command surfaces",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_BLOCKED_BY_ORB",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #44 shortcut creation",
      },
      {
        kind: "requestfailed",
        message: "net::ERR_ABORTED",
        urlPathPrefix: "/static/plasmon/icons/",
        reason: "Tracked product URL-resolution defect #190 is outside #44 shortcut creation",
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
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Files");
  const result = search.locator("[data-search-result]", { hasText: "Files" }).first();
  await expect(result).toBeVisible();
  await result.click();

  const explorer = app.getByRole("region", { name: "File Explorer" });
  await expect(explorer).toBeVisible();
  const files = explorer.getByRole("listbox", { name: "Files" });
  await expect(files).toBeVisible();
  return { explorer, files };
}

function nameFromRenameLabel(label: string | null): string {
  if (!label?.startsWith("Rename ")) throw new Error(`Unexpected rename label: ${String(label)}`);
  return label.slice("Rename ".length);
}

/**
 * #44 already has deterministic coverage for canonical NodeId metadata,
 * capabilities, collision naming, and selection state. This packaged gate proves
 * the remaining user-visible boundary through the real toolbar/context-menu
 * commands and canonical open dispatcher.
 */
test("#44 — packaged FileManager exposes and activates Create Shortcut", async ({ page }) => {
  const { app, health } = await launchPlasmon(page);
  try {
    const { explorer, files } = await openExplorer(app);
    const toolbar = files.getByRole("toolbar", { name: "File commands" });
    await expect(toolbar).toBeVisible();

    // Create one ordinary folder so the acceptance owns a stable target without
    // relying on demo content or an editor/runtime-specific target.
    await toolbar.getByRole("button", { name: "New Folder", exact: true }).click();
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

    const firstRename = files.getByRole("textbox", { name: /^Rename / }).last();
    await expect(firstRename).toBeVisible();
    await expect(firstRename).toBeFocused();
    const firstShortcutName = nameFromRenameLabel(await firstRename.getAttribute("aria-label"));
    expect(firstShortcutName).not.toBe(targetName);
    expect(firstShortcutName.startsWith(targetName)).toBe(true);

    const firstShortcut = files.locator('[data-fm-kind="shortcut"]', { has: firstRename }).first();
    await expect(firstShortcut).toBeVisible();
    await expect(firstShortcut).toHaveAttribute("aria-selected", "true");
    await expect(firstShortcut.locator(".fm-entry__icon")).toBeVisible();
    await firstRename.press("Escape");
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

    const secondRename = files.getByRole("textbox", { name: /^Rename / }).last();
    await expect(secondRename).toBeVisible();
    await expect(secondRename).toBeFocused();
    const secondShortcutName = nameFromRenameLabel(await secondRename.getAttribute("aria-label"));
    expect(secondShortcutName).not.toBe(firstShortcutName);
    expect(secondShortcutName.startsWith(targetName)).toBe(true);

    const secondShortcut = files.locator('[data-fm-kind="shortcut"]', { has: secondRename }).first();
    await expect(secondShortcut).toBeVisible();
    await expect(secondShortcut).toHaveAttribute("aria-selected", "true");
    await expect(secondShortcut.locator(".fm-entry__icon")).toBeVisible();
    await secondRename.press("Escape");
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
