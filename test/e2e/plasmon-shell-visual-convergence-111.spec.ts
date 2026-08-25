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

test("#111 — packaged Shell and native content inherit one shared visual theme", async ({ page }) => {
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
        reason: "Kernel-owned installed-app iframe warning is outside #111; this gate checks packaged Plasmon visual inheritance",
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

    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-dark");
    await taskbar.getByRole("button", { name: "Start", exact: true }).click();
    const start = plasmon.getByRole("region", { name: "Start menu" });
    await expect(start).toBeVisible();
    await start.getByRole("button", { name: "Settings", exact: true }).click();

    const settingsFlyout = plasmon.getByRole("region", { name: "Shell settings" });
    await expect(settingsFlyout).toBeVisible();
    await settingsFlyout.getByRole("button", { name: "Midnight", exact: true }).click();
    await expect(shell).toHaveAttribute("data-plasmon-theme", "plasmon-midnight");

    await expectSemanticBackground(taskbar, "--plasmon-taskbar-background");
    await expectSemanticBackground(settingsFlyout, "--plasmon-panel-elevated");

    await taskbar.getByRole("button", { name: "Search", exact: true }).click();
    const search = plasmon.getByRole("region", { name: "Search" });
    await expect(search).toBeVisible();
    await expectSemanticBackground(search, "--plasmon-panel-elevated");

    const searchInput = search.getByRole("textbox", { name: "Search Plasmon" });
    await searchInput.fill("Settings");
    const searching = search.getByRole("status").filter({ hasText: "Searching…" });
    await expect(searching).toHaveCount(0, { timeout: 20_000 });
    const settingsResult = search.locator("[data-search-result]", { hasText: "Settings" }).first();
    await expect(settingsResult).toBeVisible({ timeout: 20_000 });
    await settingsResult.click();

    const nativeSettings = plasmon.getByRole("region", { name: "Settings" }).last();
    await expect(nativeSettings).toBeVisible({ timeout: 20_000 });
    await expectSemanticBackground(nativeSettings, "--plasmon-window-background");

    await taskbar.getByRole("button", { name: /Neutron trays/ }).click();
    const tray = plasmon.getByRole("region", { name: "Neutron trays" });
    await expect(tray).toBeVisible();
    await expectSemanticBackground(tray, "--plasmon-panel-elevated");

    await taskbar.getByRole("button", { name: /Clock and calendar/ }).click();
    const calendar = plasmon.getByRole("region", { name: "Clock and calendar" });
    await expect(calendar).toBeVisible();
    await expectSemanticBackground(calendar, "--plasmon-panel-elevated");

    const startButton = taskbar.getByRole("button", { name: "Start", exact: true });
    await startButton.click({ button: "right" });
    const contextMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
    await expect(contextMenu).toBeVisible();
    await expectSemanticBackground(contextMenu, "--plasmon-panel-elevated");

    health.assertClean();
  } finally {
    health.dispose();
  }
});
