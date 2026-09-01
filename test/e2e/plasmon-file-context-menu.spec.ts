import { expect, test, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function launchPlasmon(page: Page) {
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
  return app;
}

async function contextMenuDefaultPrevented(locator: Locator): Promise<boolean> {
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

async function dispatchEscape(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

async function launchSearchResult(app: ReturnType<Page["frameLocator"]>, query: string) {
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await search.getByRole("textbox", { name: "Search Plasmon" }).fill(query);
  const result = search.locator("[data-search-result]", { hasText: query }).first();
  await expect(result).toBeVisible();
  await result.click();
}

test("first-party context ownership preserves editable and foreign boundaries", async ({ page }) => {
  const app = await launchPlasmon(page);

  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  await taskbar.click({ button: "right" });
  const shellMenu = app.getByRole("menu", { name: "Shell context menu" });
  await expect(shellMenu).toBeVisible();
  await dispatchEscape(taskbar);
  await expect(shellMenu).toHaveCount(0);

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
  await clickNewContextMenuItem(app, "New Text Document");
  const rename = app.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await expect(rename).toBeVisible();
  expect(await contextMenuDefaultPrevented(rename)).toBe(false);
  await expect(app.getByRole("menu")).toHaveCount(0);
  await rename.press("Escape");

  await launchSearchResult(app, "Browser");
  const browser = app.getByRole("region", { name: "Web browser" });
  await expect(browser).toBeVisible();
  expect(await contextMenuDefaultPrevented(browser)).toBe(true);
  const appMenu = app.getByRole("menu", { name: "Application context menu" });
  await expect(appMenu).toBeVisible();
  await expect(appMenu.getByRole("menuitem", { name: "No actions available" })).toHaveAttribute("aria-disabled", "true");
  await dispatchEscape(browser);
  await expect(appMenu).toHaveCount(0);

  const address = browser.getByRole("textbox", { name: "Web address" });
  expect(await contextMenuDefaultPrevented(address)).toBe(false);
  await expect(app.getByRole("menu", { name: "Application context menu" })).toHaveCount(0);

  await browser.evaluate((element) => {
    const iframe = document.createElement("iframe");
    iframe.title = "foreign embedded content";
    iframe.srcdoc = "<p>foreign embedded content</p>";
    element.appendChild(iframe);
  });
  const foreignFrame = browser.locator('iframe[title="foreign embedded content"]');
  await expect(foreignFrame).toBeAttached();
  expect(await contextMenuDefaultPrevented(foreignFrame)).toBe(false);
  await expect(app.getByRole("menu", { name: "Application context menu" })).toHaveCount(0);

  await launchSearchResult(app, "Files");
  const explorer = app.getByRole("region", { name: "File Explorer" });
  await expect(explorer).toBeVisible();
  const favorites = explorer.getByRole("complementary", { name: "Favorites" });
  expect(await contextMenuDefaultPrevented(favorites)).toBe(true);
  await expect(app.getByRole("menu", { name: "Application context menu" })).toBeVisible();
  await dispatchEscape(favorites);
  await expect(app.getByRole("menu", { name: "Application context menu" })).toHaveCount(0);

  const explorerFiles = explorer.getByRole("listbox", { name: "Files" });
  expect(await contextMenuDefaultPrevented(explorerFiles)).toBe(true);
  await expect(app.getByRole("menu").last()).toBeVisible();
  await expect(app.getByRole("menu", { name: "Application context menu" })).toHaveCount(0);
});
