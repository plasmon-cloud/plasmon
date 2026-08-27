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

test("#511 all five themes reach Shell, Explorer, Windowing, and Monaco in the packaged app", async ({ page }) => {
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
    // FileManager acceptance tests. This test creates its own text resource, so
    // it does not need the first-demo fixture and must not synthesize a 307 for
    // the app document: that redirect could intermittently leave a blank iframe
    // under repeated flake-probe launches.
    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector)).toBeVisible({ timeout: 60_000 });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 60_000 });

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
    // `windows.last()` is a live locator and would otherwise retarget when Text
    // opens a newer window later in the test.
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

    // Theme acceptance should not depend on a particular seeded demo filename.
    // Create the text resource through FileManager so this test owns its Monaco
    // fixture while still exercising the supported Explorer -> Text launch path.
    const generatedName = `Issue 511 Theme Probe ${Date.now()}.txt`;
    await explorer.getByRole("button", { name: "New Text Document", exact: true }).click();
    const generatedRename = explorer.locator('textarea[aria-label^="Rename New Text Document"]').last();
    await expect(generatedRename).toBeVisible();
    await generatedRename.fill(generatedName);
    await generatedRename.press("Enter");

    const themeProbe = explorer.locator("[data-fm-node-id]", { hasText: generatedName }).first();
    await expect(themeProbe).toBeVisible({ timeout: 20_000 });
    const beforeText = await windows.count();
    await themeProbe.dblclick();
    await expect(windows).toHaveCount(beforeText + 1, { timeout: 20_000 });

    const textCandidate = windows.last();
    await expect(textCandidate).toHaveAccessibleName(`${generatedName} - Monaco Editor`);
    const textWindowId = await textCandidate.getAttribute("data-window-id");
    expect(textWindowId, "Text should expose stable Windowing identity").toBeTruthy();
    const textWindow = app.locator(`.plasmon-window-layer [data-window-id="${textWindowId}"]`);
    const monacoSurface = textWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(monacoSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    // Monaco's root is a layout container and can remain transparent. The
    // internal background node is the rendered editor canvas that receives
    // the color projected from the active Plasmon Visual palette.
    const monacoCanvas = textWindow.locator(".monaco-editor-background").first();
    await expect(monacoCanvas).toBeVisible();

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
      monaco: new Set<string>(),
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
      const accent = await resolvedToken(shell, "--plasmon-accent");

      observed.desktop.add(desktop);
      observed.titlebar.add(titlebar);
      observed.fileManager.add(windowBackground);
      observed.accent.add(accent);

      await expect.poll(() => computed(explorerTitlebar, "backgroundColor")).toBe(titlebar);
      await expect.poll(() => computed(fileManager, "backgroundColor")).toBe(windowBackground);
      await expect.poll(() => computed(monacoCanvas, "backgroundColor")).toBe(windowBackground);
      observed.monaco.add(await computed(monacoCanvas, "backgroundColor"));

      const scheme = await computed(shell, "colorScheme");
      expect(scheme).toContain(theme.scheme);
    }

    expect(observed.desktop.size).toBe(THEMES.length);
    expect(observed.titlebar.size).toBe(THEMES.length);
    expect(observed.fileManager.size).toBe(THEMES.length);
    expect(observed.monaco.size).toBe(THEMES.length);
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
