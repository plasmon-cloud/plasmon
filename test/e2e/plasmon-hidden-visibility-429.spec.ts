import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { activateLocalPlaywrightIdentity } from "./local-playwright-identity.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_FRAME = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';

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

async function expectNoSearchResult(plasmon: FrameLocator, query: string, title: string): Promise<void> {
  const search = await openSearch(plasmon, query);
  await expect(search.panel.getByRole("alert")).toHaveCount(0);
  await expect(search.results.filter({ hasText: title })).toHaveCount(0);
}

async function activateSearchResult(plasmon: FrameLocator, query: string, title: string): Promise<void> {
  const search = await openSearch(plasmon, query);
  const result = search.results.filter({ hasText: title }).first();
  await expect(result).toBeVisible({ timeout: 20_000 });
  await result.click();
  await expect(search.panel).toHaveCount(0);
}

async function openSettings(plasmon: FrameLocator) {
  await activateSearchResult(plasmon, "Settings", "Settings");
  const dialog = plasmon.getByRole("dialog", { name: "Settings" }).last();
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  return dialog;
}

test("#429 — packaged hidden visibility composes global Settings with Explorer-local state", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #429; the hidden-visibility journey still runs in the packaged app",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await activateLocalPlaywrightIdentity(
      page,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );
    let plasmon = await openPlasmon(page);

    // Default global policy hides Properties through both filesystem and direct
    // NativeAppDefinition Search projection paths.
    await expectNoSearchResult(plasmon, "Properties", "Properties");
    await plasmon.getByRole("textbox", { name: "Search Plasmon" }).press("Escape");

    await plasmon.getByRole("button", { name: "Start", exact: true }).click();
    const start = plasmon.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });
    await expect(start.getByText("Properties", { exact: true })).toHaveCount(0);
    await start.getByRole("textbox", { name: "Search Start" }).press("Escape");

    const settings = await openSettings(plasmon);
    const globalHidden = settings.getByRole("checkbox", { name: "Always show hidden files" });
    await expect(globalHidden).toBeEnabled();
    await expect(globalHidden).not.toBeChecked();

    await activateSearchResult(plasmon, "Files", "Files");
    const explorer = plasmon.locator(".explorer-app").last();
    await expect(explorer).toBeVisible({ timeout: 20_000 });
    const files = explorer.getByRole("listbox", { name: "Files" });
    // Explorer paints its shell before resolveInitialLocation installs the
    // navigation model. The Files listbox appears only after that authority is
    // ready, so submitting the address before this point can be silently ignored.
    await expect(files).toBeVisible({ timeout: 20_000 });
    const address = explorer.getByRole("textbox", { name: "Address" });
    const breadcrumb = explorer.getByRole("navigation", { name: "Location breadcrumb" });
    await address.fill("/System");
    await address.press("Enter");
    await expect(breadcrumb.getByRole("button", { name: "System", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(address).toHaveValue("/System");

    const localHidden = explorer.getByRole("checkbox", { name: "Show hidden files" });
    await expect(localHidden).toBeEnabled();
    await expect(localHidden).not.toBeChecked();
    await localHidden.check();
    await expect(localHidden).toBeChecked();
    await expect(files.getByRole("option").filter({ hasText: ".Properties.sys" })).toBeVisible({ timeout: 20_000 });

    // Explorer-local visibility never leaks into global Search or Start.
    await expectNoSearchResult(plasmon, "Properties", "Properties");
    await plasmon.getByRole("textbox", { name: "Search Plasmon" }).press("Escape");
    await plasmon.getByRole("button", { name: "Start", exact: true }).click();
    await expect(start).toBeVisible();
    await expect(start.getByText("Properties", { exact: true })).toHaveCount(0);
    await start.getByRole("textbox", { name: "Search Start" }).press("Escape");

    // Global ON makes hidden resources eligible and forces Explorer's local
    // checkbox without overwriting the persisted local preference.
    await globalHidden.check();
    await expect(globalHidden).toBeChecked();
    await expect(localHidden).toBeChecked();
    await expect(localHidden).toBeDisabled();

    const globalSearch = await openSearch(plasmon, "Properties");
    const propertiesResults = globalSearch.results.filter({ hasText: "Properties" });
    await expect(propertiesResults).toHaveCount(1, { timeout: 20_000 });
    await globalSearch.input.press("Escape");

    // Turning the global policy back off hides Search/Start immediately while
    // restoring Explorer's pre-existing local ON state as editable.
    await globalHidden.uncheck();
    await expect(globalHidden).not.toBeChecked();
    await expectNoSearchResult(plasmon, "Properties", "Properties");
    await plasmon.getByRole("textbox", { name: "Search Plasmon" }).press("Escape");
    await expect(localHidden).toBeEnabled();
    await expect(localHidden).toBeChecked();

    await plasmon.getByRole("button", { name: "Start", exact: true }).click();
    await expect(start).toBeVisible();
    await expect(start.getByText("Properties", { exact: true })).toHaveCount(0);
    await start.getByRole("textbox", { name: "Search Start" }).press("Escape");

    // Persist a non-default global value through a real installed-app reload.
    await globalHidden.check();
    await expect(globalHidden).toBeChecked();
    await page.reload({ waitUntil: "domcontentloaded" });
    await activateLocalPlaywrightIdentity(
      page,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );
    plasmon = await openPlasmon(page);
    const reopenedSettings = await openSettings(plasmon);
    const reopenedGlobalHidden = reopenedSettings.getByRole("checkbox", { name: "Always show hidden files" });
    await expect(reopenedGlobalHidden).toBeChecked();
    await reopenedGlobalHidden.uncheck();

    health.assertClean();
  } finally {
    health.dispose();
  }
});
