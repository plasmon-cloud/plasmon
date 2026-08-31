import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

const STRONG_CONFIGURATION = JSON.stringify({
  schema: "plasmon.visual.presentation",
  version: 1,
  desktopLabels: { readability: "maximum" },
  transparencyChecker: { intensity: "strong", pattern: "coarse" },
}, null, 2);

test("Text save live-reloads the Visual presentation document in the running Shell", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector).first()).toBeVisible();
    const app = page.frameLocator(appSelector).first();
    const shell = app.locator(".plasmon-shell");
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-plasmon-visual-label-readability", "standard", { timeout: 20_000 });
    await expect(shell).toHaveAttribute("data-plasmon-visual-checker-intensity", "standard");
    await expect(shell).toHaveAttribute("data-plasmon-visual-checker-pattern", "standard");

    await app.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Settings" }).last();
    await expect(settings).toBeVisible({ timeout: 20_000 });
    await settings.getByRole("button", { name: "Personalization", exact: true }).click();
    await expect(settings.getByRole("heading", { name: "Advanced configuration" })).toBeVisible();

    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const beforeExplorer = await windows.count();
    await settings.getByRole("button", { name: "Open Visual configuration", exact: true }).click();
    await expect(windows).toHaveCount(beforeExplorer + 1, { timeout: 20_000 });
    const explorer = app.locator(".explorer-app").last();
    await expect(explorer).toBeVisible();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/System/Configuration/Visual");

    const configuration = explorer.locator("[data-fm-node-id]", { hasText: "presentation.json" }).first();
    await expect(configuration).toBeVisible({ timeout: 20_000 });
    const beforeText = await windows.count();
    await configuration.dblclick();
    await expect(windows).toHaveCount(beforeText + 1, { timeout: 20_000 });

    const textWindow = windows.last();
    await expect(textWindow).toHaveAttribute("aria-label", "presentation.json - Monaco Editor");
    const textSurface = textWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(textSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    const editorInput = textWindow.getByRole("textbox", { name: "Text content", exact: true, includeHidden: true }).first();
    await textWindow.locator(".monaco-editor .view-line").first().click({ position: { x: 8, y: 10 } });
    await expect(editorInput).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(STRONG_CONFIGURATION);
    await expect(textWindow.getByText("Modified", { exact: true })).toBeVisible();
    await textWindow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(textWindow.getByText("Saved", { exact: true })).toBeVisible();

    await expect(shell).toHaveAttribute("data-plasmon-visual-label-readability", "maximum", { timeout: 20_000 });
    await expect(shell).toHaveAttribute("data-plasmon-visual-checker-intensity", "strong");
    await expect(shell).toHaveAttribute("data-plasmon-visual-checker-pattern", "coarse");

    const desktopLabel = app.locator(".fm-entry--desktop:not(.is-renaming) .fm-entry__name").first();
    await expect(desktopLabel).toBeVisible();
    const textShadow = await desktopLabel.evaluate((element) => getComputedStyle(element).textShadow);
    expect(textShadow).toContain("0px 0px 6px");

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
