import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function launchPlasmon(page: Parameters<typeof test>[0]["page"]) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const frame = page.locator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(frame).toBeVisible();
  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { app, kernelUrl };
}

async function contextMenuDefaultPrevented(locator: {
  evaluate<R>(pageFunction: (element: Element) => R): Promise<R>;
}): Promise<boolean> {
  return locator.evaluate((element) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

test("#176 first-party context ownership preserves editable and Browser iframe boundaries", async ({ page }) => {
  const { app, kernelUrl } = await launchPlasmon(page);

  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  await taskbar.click({ button: "right" });
  await expect(app.getByRole("menu", { name: "Shell context menu" })).toBeVisible();
  await page.keyboard.press("Escape");

  const desktop = app.locator(".fm-root--desktop").first();
  await expect(desktop).toBeVisible();
  const bounds = await desktop.boundingBox();
  if (!bounds) throw new Error("Desktop FileManager has no browser bounds");
  await desktop.click({
    button: "right",
    position: {
      x: Math.max(120, Math.floor(bounds.width * 0.55)),
      y: Math.max(120, Math.floor(bounds.height * 0.55)),
    },
  });
  const desktopMenu = app.getByRole("menu").last();
  await desktopMenu.getByRole("menuitem", { name: "New Text Document" }).click();
  const rename = app.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await expect(rename).toBeVisible();
  expect(await contextMenuDefaultPrevented(rename)).toBe(false);
  await expect(app.getByRole("menu")).toHaveCount(0);
  await rename.press("Escape");

  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill("Browser");
  const browserResult = search.locator("[data-search-result]", { hasText: "Browser" }).first();
  await expect(browserResult).toBeVisible();
  await browserResult.click();

  const browser = app.getByRole("region", { name: "Web browser" });
  await expect(browser).toBeVisible();
  expect(await contextMenuDefaultPrevented(browser)).toBe(true);

  const address = browser.getByRole("textbox", { name: "Web address" });
  expect(await contextMenuDefaultPrevented(address)).toBe(false);
  await address.fill(kernelUrl);
  await browser.getByRole("button", { name: "Go" }).click();

  const foreignFrame = browser.locator("iframe").first();
  await expect(foreignFrame).toBeVisible();
  expect(await contextMenuDefaultPrevented(foreignFrame)).toBe(false);
});
