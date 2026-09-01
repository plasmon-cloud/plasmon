import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_FRAME = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';

async function openPlasmon(page: Page): Promise<FrameLocator> {
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  await expect(page.locator(PLASMON_FRAME)).toBeVisible({ timeout: 30_000 });
  const plasmon = page.frameLocator(PLASMON_FRAME);
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return plasmon;
}

async function expectSemanticBackground(surface: Locator, token: string): Promise<void> {
  const colors = await surface.evaluate((element, variable) => {
    const shell = element.closest<HTMLElement>(".plasmon-shell");
    if (!shell) throw new Error("Surface is not inside the Plasmon Shell");
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.backgroundColor = `var(${variable})`;
    shell.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { actual: getComputedStyle(element).backgroundColor, expected };
  }, token);
  expect(colors.actual).toBe(colors.expected);
}

async function resolvedBorder(surface: Locator, token: string): Promise<string> {
  return surface.evaluate((element, variable) => {
    const probe = document.createElement("span");
    probe.style.borderColor = `var(${variable})`;
    element.append(probe);
    const value = getComputedStyle(probe).borderColor;
    probe.remove();
    return value;
  }, token);
}

test("packaged Shell and native content inherit one shared visual theme", async ({ page }, testInfo) => {
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
        reason: "Kernel-owned installed-app iframe warning is outside this visual gate; the test checks packaged Plasmon visual inheritance",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    const plasmon = await openPlasmon(page);
    const shell = plasmon.locator(".plasmon-shell");
    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });

    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-graphite");
    await taskbar.getByRole("button", { name: "Start", exact: true }).click();
    const start = plasmon.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    const firstStartItem = start.locator("[data-start-item]").first();
    await expect(firstStartItem).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(firstStartItem).toBeFocused();
    await start.getByRole("button", { name: "Settings", exact: true }).click();

    const settingsWindow = plasmon.getByRole("dialog", { name: "Settings" }).last();
    await expect(settingsWindow).toBeVisible({ timeout: 20_000 });
    const settings = settingsWindow.getByRole("region", { name: "Settings", exact: true });
    await expect(settings).toBeVisible();
    await expect(settingsWindow).toHaveCSS("border-color", await resolvedBorder(settingsWindow, "--plasmon-selection-border"));
    await settings.getByRole("button", { name: "Personalization", exact: true }).click();
    await expect(settings.getByRole("heading", { name: "Personalization", exact: true })).toBeVisible();
    await settings.getByRole("button", { name: "Midnight", exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-midnight");

    await expectSemanticBackground(taskbar, "--plasmon-taskbar-background");
    await expectSemanticBackground(settings, "--plasmon-window-background");

    await taskbar.getByRole("button", { name: "Search", exact: true }).click();
    const search = plasmon.getByRole("region", { name: "Search" });
    await expect(search).toBeVisible();
    await expectSemanticBackground(search, "--plasmon-panel-elevated");
    await expect(search).toHaveCSS("border-color", await resolvedBorder(search, "--plasmon-border-strong"));
    const searchAllTab = search.getByRole("tab", { name: "All", exact: true });
    await expect(searchAllTab).toHaveAttribute("aria-selected", "true");
    await expectSemanticBackground(searchAllTab, "--plasmon-selection");
    await expect(searchAllTab).toHaveCSS("border-bottom-color", await resolvedBorder(searchAllTab, "--plasmon-selection-border"));

    const searchInput = search.getByRole("textbox", { name: "Search Plasmon" });
    await searchInput.fill("Settings");
    const searching = search.getByRole("status").filter({ hasText: "Searching…" });
    await expect(searching).toHaveCount(0);
    const settingsResult = search.locator("[data-search-result]", { hasText: "Settings" }).first();
    await expect(settingsResult).toBeVisible();
    await settingsResult.click();

    const nativeSettings = plasmon.getByRole("region", { name: "Settings", exact: true }).last();
    await expect(nativeSettings).toBeVisible();
    await expectSemanticBackground(nativeSettings, "--plasmon-window-background");

    const windows = plasmon.locator(".plasmon-window-layer [data-window-id]");
    await taskbar.getByRole("button", { name: "Search", exact: true }).click();
    const browserSearch = plasmon.getByRole("region", { name: "Search" });
    await expect(browserSearch).toBeVisible();
    await browserSearch.getByRole("textbox", { name: "Search Plasmon" }).fill("Browser");
    const browserAppsTab = browserSearch.getByRole("tab", { name: "Apps", exact: true });
    await browserAppsTab.click();
    await expect(browserAppsTab).toHaveAttribute("aria-selected", "true");
    await expectSemanticBackground(browserAppsTab, "--plasmon-selection");
    await expect(browserAppsTab).toHaveCSS("border-bottom-color", await resolvedBorder(browserAppsTab, "--plasmon-selection-border"));
    const browserResult = browserSearch.locator("[data-search-result]", { hasText: "Browser" }).first();
    await expect(browserResult).toBeVisible();
    const windowCountBeforeBrowser = await windows.count();
    await browserResult.click();
    await expect(windows).toHaveCount(windowCountBeforeBrowser + 1);
    const focusedTask = taskbar.locator(".plasmon-shell__task-button.is-focused").last();
    await expect(focusedTask).toBeVisible();
    await expectSemanticBackground(focusedTask, "--plasmon-selection");
    await expect(focusedTask).toHaveCSS("border-color", await resolvedBorder(focusedTask, "--plasmon-selection-border"));

    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    const altTab = plasmon.locator(".plasmon-alt-tab__switcher");
    await expect(altTab).toBeVisible();
    const selectedAltTab = altTab.locator(".plasmon-alt-tab__option.is-selected");
    await expect(selectedAltTab).toHaveCount(1);
    await expectSemanticBackground(selectedAltTab, "--plasmon-selection");
    await expect(selectedAltTab).toHaveCSS("border-color", await resolvedBorder(selectedAltTab, "--plasmon-selection-border"));
    await page.keyboard.up("Alt");

    await taskbar.getByRole("button", { name: /Neutron trays/ }).click();
    const tray = plasmon.getByRole("region", { name: "Neutron trays" });
    await expect(tray).toBeVisible();
    await expectSemanticBackground(tray, "--plasmon-panel-elevated");
    await expect(tray).toHaveCSS("border-color", await resolvedBorder(tray, "--plasmon-border-strong"));

    await taskbar.getByRole("button", { name: /Clock and calendar/ }).click();
    const calendar = plasmon.getByRole("region", { name: "Clock and calendar" });
    await expect(calendar).toBeVisible();
    await expectSemanticBackground(calendar, "--plasmon-panel-elevated");
    await expect(calendar).toHaveCSS("border-color", await resolvedBorder(calendar, "--plasmon-border-strong"));

    const startButton = taskbar.getByRole("button", { name: "Start", exact: true });
    await startButton.click({ button: "right" });
    const contextMenu = plasmon.getByRole("menu", { name: "Shell context menu" });
    await expect(contextMenu).toBeVisible();
    await expectSemanticBackground(contextMenu, "--plasmon-panel-elevated");
    await expect(contextMenu).toHaveCSS("border-color", await resolvedBorder(contextMenu, "--plasmon-border-strong"));

    await testInfo.attach("shell-visual-review.png", {
      body: await page.locator(PLASMON_FRAME).screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    health.assertClean();
  } finally {
    health.dispose();
  }
});