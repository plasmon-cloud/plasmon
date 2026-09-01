import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

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

// PocketIC and installed-app launch are the only external startup boundary;
// later assertions synchronize on production DOM readiness or browser events.
const EXTERNAL_STARTUP_TIMEOUT = 60_000;

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

test("visible, native-window, and dragged owned icons actually recolor across all six themes", async ({ page }, testInfo) => {
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
    await expect(page.locator(appSelector)).toBeVisible({ timeout: EXTERNAL_STARTUP_TIMEOUT });
    const app = page.frameLocator(appSelector);
    const shell = app.locator(".plasmon-shell");
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: EXTERNAL_STARTUP_TIMEOUT });

    const desktopFolder = app.locator('[data-plasmon-owned-icon="file-type:folder"]').first();
    await expect(desktopFolder).toBeVisible();
    const desktopFolderEntry = desktopFolder.locator("xpath=ancestor::*[@data-fm-node-id][1]");
    await expect(desktopFolderEntry).toBeVisible();
    const desktopPrimary = desktopFolder.locator('[fill*="--plasmon-icon-primary"]').first();
    await expect(desktopPrimary).toHaveCount(1);
    await expect(app.locator('img[src*="/static/plasmon/icons/folder.svg"]')).toHaveCount(0);

    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible();
    const beforeExplorer = await windows.count();
    await rootShortcut.dblclick();
    await expect(windows).toHaveCount(beforeExplorer + 1);
    const explorerCandidate = windows.last();
    await expect(explorerCandidate.getByRole("textbox", { name: "Address" })).toHaveValue("/");
    const explorerWindowId = await explorerCandidate.getAttribute("data-window-id");
    expect(explorerWindowId).toBeTruthy();
    const explorer = app.locator(`.plasmon-window-layer [data-window-id="${explorerWindowId}"]`);
    const explorerIcon = explorer.locator('.plasmon-window__icon [data-plasmon-owned-icon="system:file-manager"]');
    await expect(explorerIcon).toBeVisible();
    const explorerPrimary = explorerIcon.locator('[fill*="--plasmon-icon-primary"]').first();
    await expect(explorerPrimary).toHaveCount(1);

    // The installed Review.neutron projection is authored external artwork. It
    // must remain an image in its resting row and in the drag preview while
    // owned SVGs below recolor with the active theme.
    const explorerAddress = explorer.getByRole("textbox", { name: "Address" });
    await explorer.locator("[data-fm-node-id]", { hasText: "Apps" }).first().dblclick();
    await expect(explorerAddress).toHaveValue("/Apps");
    const reviewProjection = explorer.locator("[data-fm-node-id]", { hasText: "Review.neutron" }).first();
    await expect(reviewProjection).toBeVisible();
    const reviewImage = reviewProjection.locator("img.plasmon-native-app-icon");
    await expect(reviewImage).toHaveCount(1);
    const authoredReviewSrc = await reviewImage.getAttribute("src");
    expect(authoredReviewSrc).toMatch(/\/app\/review\/assets\/hackathon-native-logo\.svg$/u);

    const reviewBounds = await reviewProjection.boundingBox();
    if (!reviewBounds) throw new Error("Review.neutron has no browser bounds");
    const reviewX = reviewBounds.x + reviewBounds.width / 2;
    const reviewY = reviewBounds.y + reviewBounds.height / 2;
    await page.mouse.move(reviewX, reviewY);
    await page.mouse.down();
    await page.mouse.move(reviewX + 72, reviewY + 44, { steps: 8 });
    const externalPreview = app.locator('[data-fm-drag-preview]');
    await expect(externalPreview).toBeVisible();
    const previewReviewImage = externalPreview.locator("img.plasmon-native-app-icon");
    await expect(previewReviewImage).toHaveCount(1);
    await expect(previewReviewImage).toHaveAttribute("src", authoredReviewSrc!);
    await page.keyboard.press("Escape");
    await expect(externalPreview).toHaveCount(0);

    const openThemeSettings = async (): Promise<{ settings: Locator; window: Locator }> => {
      await app.getByRole("button", { name: "Start", exact: true }).click();
      const start = app.getByRole("region", { name: "Start menu" });
      await expect(start).toBeVisible();
      await start.getByRole("button", { name: "Settings", exact: true }).click();
      const window = app.getByRole("dialog", { name: "Settings" }).last();
      await expect(window).toBeVisible({ timeout: 20_000 });
      const settings = window.getByRole("region", { name: "Settings", exact: true });
      await expect(settings).toBeVisible();
      await settings.getByRole("button", { name: "Personalization", exact: true }).click();
      await expect(settings.getByRole("heading", { name: "Personalization", exact: true })).toBeVisible();
      return { settings, window };
    };

    const observedDesktopFills = new Set<string>();
    const observedExplorerFills = new Set<string>();
    const observedDragFills = new Set<string>();

    for (const theme of THEMES) {
      const { settings, window: settingsWindow } = await openThemeSettings();
      const choice = settings.getByRole("button", { name: theme.label, exact: true });
      await choice.click();
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await expect(shell).toHaveAttribute("data-plasmon-theme", theme.id);
      await expect(reviewImage).toHaveAttribute("src", authoredReviewSrc!);

      const expectedPrimary = await resolvedToken(shell, "--plasmon-icon-primary");
      await expect.poll(() => computedFill(desktopPrimary)).toBe(expectedPrimary);
      await expect.poll(() => computedFill(explorerPrimary)).toBe(expectedPrimary);
      observedDesktopFills.add(await computedFill(desktopPrimary));
      observedExplorerFills.add(await computedFill(explorerPrimary));

      await settingsWindow.getByRole("button", { name: "Close", exact: true }).click();
      await expect(settingsWindow).not.toBeVisible();
      const source = await desktopFolderEntry.boundingBox();
      if (!source) throw new Error("Desktop folder has no browser bounds");
      const sourceX = source.x + source.width / 2;
      const sourceY = source.y + source.height / 2;
      await page.mouse.move(sourceX, sourceY);
      await page.mouse.down();
      await page.mouse.move(sourceX + 72, sourceY + 44, { steps: 8 });

      const preview = app.locator('[data-fm-drag-preview]');
      await expect(preview).toBeVisible();
      const previewFolder = preview.locator('[data-plasmon-owned-icon="file-type:folder"]').first();
      await expect(previewFolder).toBeVisible();
      await expect(preview.locator('img[src*="/static/plasmon/icons/folder.svg"]')).toHaveCount(0);
      const previewPrimary = previewFolder.locator('[fill*="--plasmon-icon-primary"]').first();
      await expect(previewPrimary).toHaveCount(1);
      await expect.poll(() => computedFill(previewPrimary)).toBe(expectedPrimary);
      observedDragFills.add(await computedFill(previewPrimary));
      await testInfo.attach(`theme-icons-${theme.id}.png`, {
        body: await page.locator(appSelector).screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });

      await page.keyboard.press("Escape");
      await expect(preview).toHaveCount(0);
    }

    expect(observedDesktopFills.size).toBe(THEMES.length);
    expect(observedExplorerFills.size).toBe(THEMES.length);
    expect(observedDragFills.size).toBe(THEMES.length);

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