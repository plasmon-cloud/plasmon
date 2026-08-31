import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

const THEMES = [
  { id: "plasmon-graphite", label: "Graphite" },
  { id: "plasmon-verdant", label: "Verdant" },
  { id: "plasmon-midnight", label: "Midnight" },
  { id: "plasmon-ember", label: "Ember" },
  { id: "plasmon-glacier", label: "Glacier" },
  { id: "plasmon-rosewood", label: "Rosewood" },
] as const;

// PocketIC and the installed app have an external startup boundary; all later
// assertions synchronize on production DOM readiness or browser events.
const EXTERNAL_STARTUP_TIMEOUT = 60_000;
// Monaco's packaged editor worker loads after Shell readiness through the
// Program Files runtime, so this is a worker-startup bound rather than a
// routine surface wait.
const MONACO_WORKER_TIMEOUT = 30_000;

async function resolvedToken(locator: Locator, token: string): Promise<string> {
  return locator.evaluate((element, property) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${property})`;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    element.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

async function computed(locator: Locator, property: "backgroundColor" | "color" | "colorScheme"): Promise<string> {
  return locator.evaluate((element, name) => getComputedStyle(element)[name], property);
}

test("all six themes reach Shell, Desktop, Windowing, and representative native-app chrome", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector)).toBeVisible({ timeout: EXTERNAL_STARTUP_TIMEOUT });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: EXTERNAL_STARTUP_TIMEOUT });

    const desktopEntry = app.locator(".fm-root--desktop .fm-entry--desktop").first();
    await expect(desktopEntry).toBeVisible();
    await desktopEntry.click();
    const desktopExpandedName = desktopEntry.locator(".fm-entry__expanded-name");
    await expect(desktopExpandedName).toBeVisible();

    const windows = app.locator(".plasmon-window-layer [data-window-id]");

    const openNativeAppFromSearch = async (name: string): Promise<Locator> => {
      await taskbar.getByRole("button", { name: "Search", exact: true }).click();
      const search = app.getByRole("region", { name: "Search" });
      await expect(search).toBeVisible();
      await search.getByRole("textbox", { name: "Search Plasmon" }).fill(name);
      const result = search.locator("[data-search-result]", { hasText: name }).first();
      await expect(result).toBeVisible();
      const before = await windows.count();
      await result.click();
      await expect(windows).toHaveCount(before + 1);
      const candidate = windows.last();
      const windowId = await candidate.getAttribute("data-window-id");
      expect(windowId, `${name} should expose stable Windowing identity`).toBeTruthy();
      return app.locator(`.plasmon-window-layer [data-window-id="${windowId}"]`);
    };

    await taskbar.getByRole("button", { name: "Search", exact: true }).click();
    const search = app.getByRole("region", { name: "Search" });
    await expect(search).toBeVisible();
    await search.getByRole("textbox", { name: "Search Plasmon" }).fill("File Explorer");
    const filesResult = search.locator("[data-search-result]", { hasText: "File Explorer" }).first();
    await expect(filesResult).toBeVisible();
    const beforeExplorer = await windows.count();
    await filesResult.click();
    await expect(windows).toHaveCount(beforeExplorer + 1);

    const explorerCandidate = windows.last();
    const explorerCandidateAddress = explorerCandidate.getByRole("textbox", { name: "Address" });
    await expect(explorerCandidateAddress).toHaveValue("/");
    await expect(explorerCandidate).toHaveAccessibleName("This Plasmon — File Explorer");
    const explorerWindowId = await explorerCandidate.getAttribute("data-window-id");
    expect(explorerWindowId, "Explorer should expose stable Windowing identity").toBeTruthy();
    const explorer = app.locator(`.plasmon-window-layer [data-window-id="${explorerWindowId}"]`);
    const explorerAddress = explorer.getByRole("textbox", { name: "Address" });
    const explorerTitlebar = explorer.locator(".plasmon-window__titlebar");
    const fileManager = explorer.locator(".fm-root").first();
    await expect(fileManager).toBeVisible();

    await explorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();
    await expect(explorerAddress).toHaveValue("/Documents");
    await expect(explorer).toHaveAccessibleName("Documents — File Explorer");

    const generatedName = `Theme Probe ${Date.now()}.md`;
    await chooseFileManagerBackgroundAction(
      explorer.getByRole("listbox", { name: "Files" }),
      "New Markdown Document",
    );
    const generatedRename = explorer.locator('textarea[aria-label^="Rename New Markdown Document"]').last();
    await expect(generatedRename).toBeVisible();
    await generatedRename.fill(generatedName);
    await generatedRename.press("Enter");

    const themeProbe = explorer.locator("[data-fm-node-id]", { hasText: generatedName }).first();
    await expect(themeProbe).toBeVisible();
    const beforeMarkdown = await windows.count();
    await themeProbe.dblclick();
    await expect(windows).toHaveCount(beforeMarkdown + 1);

    const markdownCandidate = windows.last();
    await expect(markdownCandidate).toHaveAccessibleName(`${generatedName} - Monaco Editor`);
    const markdownWindowId = await markdownCandidate.getAttribute("data-window-id");
    expect(markdownWindowId, "Markdown should expose stable Windowing identity").toBeTruthy();
    const markdownWindow = app.locator(`.plasmon-window-layer [data-window-id="${markdownWindowId}"]`);
    const monacoSurface = markdownWindow.locator('[data-editor-engine="monaco"][aria-label="Markdown source"]');
    await expect(monacoSurface).toHaveAttribute("data-editor-ready", "true", { timeout: MONACO_WORKER_TIMEOUT });
    const monacoCanvas = markdownWindow.locator(".monaco-editor-background").first();
    await expect(monacoCanvas).toBeVisible();
    await markdownWindow.getByRole("button", { name: "Split", exact: true }).click();
    const markdownPreview = markdownWindow.locator(".plasmon-markdown-preview");
    await expect(markdownPreview).toBeVisible();

    const browserWindow = await openNativeAppFromSearch("Browser");
    const browserSurface = browserWindow.getByRole("region", { name: "Web browser" });
    await expect(browserSurface).toBeVisible();
    const browserToolbar = browserSurface.locator("form").first();
    const browserAddress = browserWindow.getByRole("textbox", { name: "Web address" });
    await expect(browserToolbar).toBeVisible();
    await expect(browserAddress).toBeVisible();

    const nativeSettingsWindow = await openNativeAppFromSearch("Settings");
    const nativeSettingsSurface = nativeSettingsWindow.getByRole("region", { name: "Settings" });
    const nativeSettingsPanel = nativeSettingsSurface.locator(".plasmon-native-app-panel").first();
    await expect(nativeSettingsSurface).toBeVisible();
    await expect(nativeSettingsPanel).toBeVisible();

    await taskbar.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(nativeSettingsWindow).toHaveClass(/plasmon-window--active/);
    const settings = nativeSettingsSurface;
    await expect(settings).toBeVisible();

    const darkAppearance = settings.getByRole("button", { name: "Dark", exact: true });
    await darkAppearance.click();
    await expect(darkAppearance).toHaveAttribute("aria-pressed", "true");
    await expect(shell).toHaveAttribute("data-plasmon-appearance", "dark");

    const observed = {
      desktop: new Set<string>(),
      titlebar: new Set<string>(),
      fileManager: new Set<string>(),
      desktopLabel: new Set<string>(),
      monaco: new Set<string>(),
      markdown: new Set<string>(),
      browser: new Set<string>(),
      nativeSettings: new Set<string>(),
      accent: new Set<string>(),
    };

    for (const theme of THEMES) {
      const choice = settings.getByRole("button", { name: theme.label, exact: true });
      await choice.click();
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await expect(shell).toHaveAttribute("data-plasmon-theme", theme.id);
      await expect(shell).toHaveAttribute("data-plasmon-appearance", "dark");

      const desktop = await resolvedToken(shell, "--plasmon-desktop-background");
      const titlebar = await resolvedToken(shell, "--plasmon-window-titlebar");
      const windowBackground = await resolvedToken(shell, "--plasmon-window-background");
      const panelElevated = await resolvedToken(shell, "--plasmon-panel-elevated");
      const controlBackground = await resolvedToken(shell, "--plasmon-control-background");
      const textPrimary = await resolvedToken(shell, "--plasmon-text-primary");
      const accent = await resolvedToken(shell, "--plasmon-accent");

      observed.desktop.add(desktop);
      observed.titlebar.add(titlebar);
      observed.fileManager.add(windowBackground);
      observed.desktopLabel.add(panelElevated);
      observed.accent.add(accent);

      await expect.poll(() => computed(explorerTitlebar, "backgroundColor")).toBe(titlebar);
      await expect.poll(() => computed(fileManager, "backgroundColor")).toBe(windowBackground);
      await expect.poll(() => computed(desktopExpandedName, "backgroundColor")).toBe(panelElevated);
      await expect.poll(() => computed(desktopExpandedName, "color")).toBe(textPrimary);
      await expect.poll(() => computed(monacoCanvas, "backgroundColor")).toBe(windowBackground);
      await expect.poll(() => computed(markdownPreview, "backgroundColor")).toBe(windowBackground);
      await expect.poll(() => computed(markdownPreview, "color")).toBe(textPrimary);
      await expect.poll(() => computed(browserSurface, "backgroundColor")).toBe(windowBackground);
      await expect.poll(() => computed(browserToolbar, "backgroundColor")).toBe(panelElevated);
      await expect.poll(() => computed(browserAddress, "backgroundColor")).toBe(controlBackground);
      await expect.poll(() => computed(browserAddress, "color")).toBe(textPrimary);
      await expect.poll(() => computed(nativeSettingsSurface, "backgroundColor")).toBe(windowBackground);
      await expect.poll(() => computed(nativeSettingsSurface, "color")).toBe(textPrimary);
      await expect.poll(() => computed(nativeSettingsPanel, "backgroundColor")).toBe(panelElevated);
      observed.monaco.add(await computed(monacoCanvas, "backgroundColor"));
      observed.markdown.add(await computed(markdownPreview, "backgroundColor"));
      observed.browser.add(await computed(browserSurface, "backgroundColor"));
      observed.nativeSettings.add(await computed(nativeSettingsSurface, "backgroundColor"));

      const scheme = await computed(shell, "colorScheme");
      expect(scheme).toContain("dark");
      await testInfo.attach(`theme-${theme.id}.png`, {
        body: await page.locator(appSelector).screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    }

    expect(observed.desktop.size).toBe(THEMES.length);
    expect(observed.titlebar.size).toBe(THEMES.length);
    expect(observed.fileManager.size).toBe(THEMES.length);
    expect(observed.desktopLabel.size).toBe(THEMES.length);
    expect(observed.monaco.size).toBe(THEMES.length);
    expect(observed.markdown.size).toBe(THEMES.length);
    expect(observed.browser.size).toBe(THEMES.length);
    expect(observed.nativeSettings.size).toBe(THEMES.length);
    expect(observed.accent.size).toBe(THEMES.length);

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
