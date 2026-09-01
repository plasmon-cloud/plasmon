import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { activateLocalPlaywrightIdentity } from "./local-playwright-identity.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";

const PLASMON_FRAME = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
const HIDDEN_TARGET_NAME = ".Start Hidden Fixture.txt";
const START_FIXTURE_NAME = "Start Hidden Fixture";

async function openPlasmon(page: Page): Promise<FrameLocator> {
  const frame = page.locator(PLASMON_FRAME).first();
  if (await frame.count() === 0) {
    const launcher = page.locator('[data-tid="launcher"]');
    if (!await launcher.isVisible()) await page.locator('[data-tid="launcher-open"]').click();
    await expect(launcher).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  }
  await expect(frame).toBeVisible({ timeout: 30_000 });
  const plasmon = page.frameLocator(PLASMON_FRAME).first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return plasmon;
}

async function openSearch(plasmon: FrameLocator, query: string) {
  const existing = plasmon.getByRole("region", { name: "Search" });
  if (!await existing.isVisible().catch(() => false)) {
    await plasmon.getByRole("button", { name: "Search" }).click();
  }
  const panel = plasmon.getByRole("region", { name: "Search" });
  await expect(panel).toBeVisible();
  const input = panel.getByRole("textbox", { name: "Search Plasmon" });
  await input.fill(query);
  const searching = panel.getByRole("status").filter({ hasText: "Searching…" });
  await expect(searching).toBeVisible({ timeout: 5_000 });
  await expect(searching).toHaveCount(0, { timeout: 20_000 });
  return { panel, input, results: panel.locator("[data-search-result]") };
}

async function activateSearchResult(plasmon: FrameLocator, query: string, title: string): Promise<void> {
  const search = await openSearch(plasmon, query);
  const result = search.results.filter({ hasText: title }).first();
  await expect(result).toBeVisible({ timeout: 20_000 });
  await result.click();
  await expect(search.panel).toHaveCount(0);
}

async function expectStartFixture(plasmon: FrameLocator, visible: boolean): Promise<void> {
  await plasmon.getByRole("button", { name: "Start", exact: true }).click();
  const start = plasmon.getByRole("region", { name: "Start menu" });
  await expect(start).toBeVisible();
  await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });
  const fixture = start.getByText(START_FIXTURE_NAME, { exact: true });
  if (visible) {
    await expect(fixture).toBeVisible({ timeout: 20_000 });
    // Plasmon-owned icons are inline SVG, so assert the rendered icon contract
    // directly rather than waiting for a removed image request to settle.
    await expect(
      fixture.locator("xpath=ancestor::button[1]").locator("[data-plasmon-owned-icon]").first(),
    ).toBeVisible();
  } else await expect(fixture).toHaveCount(0);
  await start.getByRole("textbox", { name: "Search Start" }).press("Escape");
}

test("packaged Start follows global visibility for an existing hidden target", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  let health: ReturnType<typeof installPlasmonBrowserHealth> | undefined;

  try {
    await page.goto(kernelUrl);
    await activateLocalPlaywrightIdentity(
      page,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );
    const plasmon = await openPlasmon(page);

    // Build the fixture entirely through packaged FileManager behavior. The
    // Start entry itself has a visible name; only its stable-NodeId target is
    // hidden, so this exercises Start's canonical target-visibility boundary.
    await activateSearchResult(plasmon, "File Explorer", "File Explorer");
    const explorer = plasmon.locator(".explorer-app").last();
    await expect(explorer).toBeVisible({ timeout: 20_000 });
    const files = explorer.getByRole("listbox", { name: "Files" });
    const toolbar = explorer.getByRole("toolbar", { name: "File commands" });
    const address = explorer.getByRole("textbox", { name: "Address" });
    await expect(address).toHaveValue("/");

    await chooseFileManagerBackgroundAction(files, "New Text Document");
    const targetRename = files.locator('textarea[aria-label^="Rename "]').first();
    await expect(targetRename).toBeVisible();
    await targetRename.fill(HIDDEN_TARGET_NAME);
    await targetRename.press("Enter");

    const localHidden = explorer.getByRole("checkbox", { name: "Show hidden files" });
    await expect(localHidden).toBeEnabled();
    await localHidden.check();
    const hiddenTarget = files.getByRole("option").filter({ hasText: HIDDEN_TARGET_NAME }).first();
    await expect(hiddenTarget).toBeVisible({ timeout: 20_000 });
    await hiddenTarget.click();

    const createShortcut = toolbar.getByRole("button", { name: "Create Shortcut", exact: true });
    await expect(createShortcut).toBeEnabled();
    await createShortcut.click();
    const shortcutRename = files.locator('textarea[aria-label^="Rename "]').first();
    await expect(shortcutRename).toBeVisible();
    await shortcutRename.fill(START_FIXTURE_NAME);
    await shortcutRename.press("Enter");

    // Match the shortcut's exact name; the hidden target filename contains the
    // same words and must not be selected for Cut.
    const shortcut = files.getByRole("option", { name: START_FIXTURE_NAME, exact: true });
    await expect(shortcut).toBeVisible({ timeout: 20_000 });
    await shortcut.click();
    const cut = toolbar.getByRole("button", { name: "Cut", exact: true });
    await expect(cut).toBeEnabled();
    await cut.click();

    const systemEntry = files.getByRole("option").filter({ hasText: "System" }).first();
    await expect(systemEntry).toBeVisible({ timeout: 20_000 });
    await systemEntry.dblclick();
    await expect(address).toHaveValue("/System", { timeout: 20_000 });
    const startMenuEntry = files.getByRole("option").filter({ hasText: "Start Menu" }).first();
    await expect(startMenuEntry).toBeVisible({ timeout: 20_000 });
    await startMenuEntry.dblclick();
    await expect(address).toHaveValue("/System/Start Menu", { timeout: 20_000 });
    const paste = toolbar.getByRole("button", { name: "Paste", exact: true });
    await expect(paste).toBeEnabled();
    await paste.click();
    await expect(files.getByRole("option").filter({ hasText: START_FIXTURE_NAME })).toBeVisible({ timeout: 20_000 });

    // Setup navigation can legitimately cancel a transient file icon request.
    // Scope BrowserHealth to the actual visibility acceptance after the fixture
    // is fully constructed, keeping its assertions strict for the behavior
    // under test without masking any acceptance-phase failure.
    health = installPlasmonBrowserHealth(page, {
      firstPartyOrigins: [kernelUrl],
      allow: [
        {
          kind: "console.warn",
          messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
          urlPathPrefix: "/chunks/",
          reason: "Kernel-owned installed-app iframe warning is outside the hidden-visibility journey",
        },
      ],
    });

    // Default global OFF hides a visible shortcut whose canonical target is hidden.
    await expectStartFixture(plasmon, false);

    await activateSearchResult(plasmon, "Settings", "Settings");
    const settings = plasmon.getByRole("dialog", { name: "Settings" }).last();
    await expect(settings).toBeVisible({ timeout: 20_000 });
    await settings.getByRole("button", { name: "Files & Explorer", exact: true }).click();
    await expect(settings.getByRole("heading", { name: "Files & Explorer", exact: true })).toBeVisible();
    const globalHidden = settings.getByRole("checkbox", { name: "Always show hidden files" });
    await expect(globalHidden).toBeEnabled();
    await expect(globalHidden).not.toBeChecked();

    // Global ON makes the existing hidden target eligible in Start without
    // rewriting the shortcut or relying on Explorer's local visibility state.
    await globalHidden.check();
    await expect(globalHidden).toBeChecked();
    // Settings is a native window and can remain above the Shell flyout after
    // its preference mutation. Close it before opening Start so the assertion
    // observes the visible production Start surface rather than z-order.
    await settings.getByRole("button", { name: "Close", exact: true }).click();
    await expect(settings).not.toBeVisible();
    await expectStartFixture(plasmon, true);

    // Returning global visibility OFF immediately filters the same Start entry.
    // The previous Settings window was intentionally closed before opening
    // Start, so reopen it through the ordinary Search activation boundary.
    await activateSearchResult(plasmon, "Settings", "Settings");
    await expect(settings).toBeVisible({ timeout: 20_000 });
    await settings.getByRole("button", { name: "Files & Explorer", exact: true }).click();
    await expect(settings.getByRole("heading", { name: "Files & Explorer", exact: true })).toBeVisible();
    await globalHidden.uncheck();
    await expect(globalHidden).not.toBeChecked();
    await settings.getByRole("button", { name: "Close", exact: true }).click();
    await expect(settings).not.toBeVisible();
    await expectStartFixture(plasmon, false);

    if (!health) throw new Error("BrowserHealth was not installed");
    health.assertClean();
  } finally {
    health?.dispose();
  }
});