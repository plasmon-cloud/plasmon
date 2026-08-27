import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const THEMES = [
  { id: "plasmon-dark", label: "Plasmon Dark" },
  { id: "plasmon-midnight", label: "Midnight" },
  { id: "plasmon-ember", label: "Ember" },
  { id: "plasmon-glacier", label: "Glacier" },
  { id: "plasmon-rosewood", label: "Rosewood" },
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

async function computedFill(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).fill);
}

/**
 * This is deliberately a rendered-color acceptance test, not a token/source or
 * asset-loading test. It catches the #513 failure mode where the palette exists
 * but fixed-color SVG files are still rendered through <img> and never inherit
 * the active Shell theme.
 */
test("#513 visible Desktop and native-window icons actually recolor across all five themes", async ({ page }) => {
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
    await expect(page.locator(appSelector)).toBeVisible({ timeout: 60_000 });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 60_000 });

    // Use the real Desktop folder shown to users. It must be an inline owned SVG,
    // not a fixed-color external image document.
    const desktopFolder = app.locator('[data-plasmon-owned-icon="file-type:folder"]').first();
    await expect(desktopFolder).toBeVisible({ timeout: 30_000 });
    const desktopPrimary = desktopFolder.locator('[fill*="--plasmon-icon-primary"]').first();
    await expect(desktopPrimary).toHaveCount(1);
    await expect(app.locator('img[src*="/static/plasmon/icons/folder.svg"]')).toHaveCount(0);

    // Open the real Explorer window so native titlebar identity is covered too.
    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    const beforeExplorer = await windows.count();
    await rootShortcut.dblclick();
    await expect(windows).toHaveCount(beforeExplorer + 1, { timeout: 20_000 });
    const explorerCandidate = windows.last();
    await expect(explorerCandidate.getByRole("textbox", { name: "Address" })).toHaveValue("/", { timeout: 20_000 });
    const explorerWindowId = await explorerCandidate.getAttribute("data-window-id");
    expect(explorerWindowId).toBeTruthy();
    const explorer = app.locator(`.plasmon-window-layer [data-window-id="${explorerWindowId}"]`);
    const explorerIcon = explorer.locator('.plasmon-window__icon [data-plasmon-owned-icon="system:file-manager"]');
    await expect(explorerIcon).toBeVisible();
    const explorerPrimary = explorerIcon.locator('[fill*="--plasmon-icon-primary"]').first();
    await expect(explorerPrimary).toHaveCount(1);

    await app.getByRole("button", { name: "Start", exact: true }).click();
    const start = app.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = app.getByRole("region", { name: "Shell settings" });
    await expect(settings).toBeVisible();

    const observedDesktopFills = new Set<string>();
    const observedExplorerFills = new Set<string>();

    for (const theme of THEMES) {
      const choice = settings.getByRole("button", { name: theme.label, exact: true });
      await choice.click();
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await expect(shell).toHaveAttribute("data-plasmon-theme", theme.id);

      const expectedPrimary = await resolvedToken(shell, "--plasmon-icon-primary");
      await expect.poll(() => computedFill(desktopPrimary)).toBe(expectedPrimary);
      await expect.poll(() => computedFill(explorerPrimary)).toBe(expectedPrimary);

      observedDesktopFills.add(await computedFill(desktopPrimary));
      observedExplorerFills.add(await computedFill(explorerPrimary));
    }

    // This is the critical regression assertion: five theme selections must
    // produce five different colors on the actual rendered icon geometry.
    expect(observedDesktopFills.size).toBe(THEMES.length);
    expect(observedExplorerFills.size).toBe(THEMES.length);

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
