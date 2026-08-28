import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

const THEMES = [
  { id: "plasmon-dark", label: "Plasmon Dark", scheme: "dark" },
  { id: "plasmon-midnight", label: "Midnight", scheme: "dark" },
  { id: "plasmon-ember", label: "Ember", scheme: "dark" },
  { id: "plasmon-glacier", label: "Glacier", scheme: "light" },
  { id: "plasmon-rosewood", label: "Rosewood", scheme: "dark" },
] as const;

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

test("#511 all five themes reach Shell, Desktop state, Explorer, Windowing, Monaco, and Markdown in the packaged app", async ({ page }) => {
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

    // Use the same direct packaged launch boundary as the established Shell and
    // FileManager acceptance tests. This test creates its own Markdown resource,
    // so it does not need a seeded fixture or a synthetic app-document redirect.
    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector)).toBeVisible({ timeout: 60_000 });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 60_000 });

    // Keep one real Desktop item selected throughout theme switching. The
    // expanded selected-name plate previously kept fixed dark styling even when
    // Glacier switched the rest of the system to its light palette.
    const desktopEntry = app.locator(".fm-root--desktop .fm-entry--desktop").first();
    await expect(desktopEntry).toBeVisible({ timeout: 20_000 });
    await desktopEntry.click();
    const desktopExpandedName = desktopEntry.locator(".fm-entry__expanded-name");
    await expect(desktopExpandedName).toBeVisible();

    const windows = app.locator(".plasmon-window-layer [data-window-id]");

    // Open Explorer through the canonical Search projection, matching the
    // packaged FileManager gate rather than depending on a seeded Desktop
    // shortcut. Count Windowing objects before activation so the concrete
    // Explorer window can be captured without a role-specific implementation
    // dependency.
    await taskbar.getByRole("button", { name: "Search", exact: true }).click();
    const search = app.getByRole("region", { name: "Search" });
    await expect(search).toBeVisible();
    await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Files");
    const filesResult = search.locator("[data-search-result]", { hasText: "Files" }).first();
    await expect(filesResult).toBeVisible({ timeout: 20_000 });
    const beforeExplorer = await windows.count();
    await filesResult.click();
    await expect(windows).toHaveCount(beforeExplorer + 1, { timeout: 20_000 });

    // Window creation is only the process boundary. Explorer publishes its
    // title and FileManager tree asynchronously, so bind its canonical Address
    // control before asserting presentation. Capture the concrete window id:
    // `windows.last()` is a live locator and would otherwise retarget when the
    // Markdown window opens later in the test.
    const explorerCandidate = windows.last();
    const explorerCandidateAddress = explorerCandidate.getByRole("textbox", { name: "Address" });
    await expect(explorerCandidateAddress).toHaveValue("/", { timeout: 20_000 });
    await expect(explorerCandidate).toHaveAccessibleName("This Plasmon");
    const explorerWindowId = await explorerCandidate.getAttribute("data-window-id");
    expect(explorerWindowId, "Explorer should expose stable Windowing identity").toBeTruthy();
    const explorer = app.locator(`.plasmon-window-layer [data-window-id="${explorerWindowId}"]`);
    const explorerAddress = explorer.getByRole("textbox", { name: "Address" });
    const explorerTitlebar = explorer.locator(".plasmon-window__titlebar");
    // `.fm-root` is the active reusable FileManager root; `.fm-window` is stale.
    const fileManager = explorer.locator(".fm-root").first();
    await expect(fileManager).toBeVisible();

    await explorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();
    await expect(explorerAddress).toHaveValue("/Documents");
    await expect(explorer).toHaveAccessibleName("Documents");

    // One owned Markdown document proves both the shared Monaco canvas and the
    // app-owned rendered preview. This avoids a fixture dependency while covering
    // the dark preview leak visible in Glacier during manual review.
    const generatedName = `Issue 511 Theme Probe ${Date.now()}.md`;
    await explorer.getByRole("button", { name: "New Markdown Document", exact: true }).click();
    const generatedRename = explorer.locator('textarea[aria-label^="Rename New Markdown Document"]').last();
    await expect(generatedRename).toBeVisible();
    await generatedRename.fill(generatedName);
    await generatedRename.press("Enter");

    const themeProbe = explorer.locator("[data-fm-node-id]", { hasText: generatedName }).first();
    await expect(themeProbe).toBeVisible({ timeout: 20_000 });
    const beforeMarkdown = await windows.count();
    await themeProbe.dblclick();
    await expect(windows).toHaveCount(beforeMarkdown + 1, { timeout: 20_000 });

    const markdownCandidate = windows.last();
    await expect(markdownCandidate).toHaveAccessibleName(`${generatedName} - Monaco Editor`);
    const markdownWindowId = await markdownCandidate.getAttribute("data-window-id");
    expect(markdownWindowId, "Markdown should expose stable Windowing identity").toBeTruthy();
    const markdownWindow = app.locator(`.plasmon-window-layer [data-window-id="${markdownWindowId}"]`);
    const monacoSurface = markdownWindow.locator('[data-editor-engine="monaco"][aria-label="Markdown source"]');
    await expect(monacoSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    // Monaco's root is a layout container and can remain transparent. The
    // internal background node is the rendered editor canvas that receives
    // the color projected from the active Plasmon Visual palette.
    const monacoCanvas = markdownWindow.locator(".monaco-editor-background").first();
    await expect(monacoCanvas).toBeVisible();
    await markdownWindow.getByRole("button", { name: "Split", exact: true }).click();
    const markdownPreview = markdownWindow.locator(".plasmon-markdown-preview");
    await expect(markdownPreview).toBeVisible();

    await taskbar.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Shell settings" });
    await expect(settings).toBeVisible();

    const observed = {
      desktop: new Set<string>(),
      titlebar: new Set<string>(),
      fileManager: new Set<string>(),
      desktopLabel: new Set<string>(),
      monaco: new Set<string>(),
      markdown: new Set<string>(),
      accent: new Set<string>(),
    };

    for (const theme of THEMES) {
      const choice = settings.getByRole("button", { name: theme.label, exact: true });
      await choice.click();
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await expect(shell).toHaveAttribute("data-plasmon-theme", theme.id);

      const desktop = await resolvedToken(shell, "--plasmon-desktop-background");
      const titlebar = await resolvedToken(shell, "--plasmon-window-titlebar");
      const windowBackground = await resolvedToken(shell, "--plasmon-window-background");
      const panelElevated = await resolvedToken(shell, "--plasmon-panel-elevated");
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
      observed.monaco.add(await computed(monacoCanvas, "backgroundColor"));
      observed.markdown.add(await computed(markdownPreview, "backgroundColor"));

      const scheme = await computed(shell, "colorScheme");
      expect(scheme).toContain(theme.scheme);
    }

    expect(observed.desktop.size).toBe(THEMES.length);
    expect(observed.titlebar.size).toBe(THEMES.length);
    expect(observed.fileManager.size).toBe(THEMES.length);
    expect(observed.desktopLabel.size).toBe(THEMES.length);
    expect(observed.monaco.size).toBe(THEMES.length);
    expect(observed.markdown.size).toBe(THEMES.length);
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
