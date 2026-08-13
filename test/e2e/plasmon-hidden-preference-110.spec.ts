import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("#110 packaged boundary — Show Hidden Files persists through reopen and reload", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator("[data-tid=launcher-open]").click();
  await page.locator(`[data-tid=launcher-tile-${APP_ID}-${TILE_ID}]`).click();
  const frameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  const app = page.frameLocator(frameSelector).first();
  await expect(app.locator(".fm-root--desktop")).toBeVisible({ timeout: 30_000 });

  const desktop = app.locator(".fm-root--desktop");
  const box = await desktop.boundingBox();
  if (!box) throw new Error("Desktop has no bounds");
  await desktop.click({ button: "right", position: { x: Math.max(120, box.width / 2), y: Math.max(120, box.height / 2) }});
  await app.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
  const rename = app.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await rename.fill(".hidden-110.txt");
  await rename.press("Enter");
  await expect(app.locator("[data-fm-node-id]", { hasText: ".hidden-110.txt" })).toHaveCount(0);

  const root = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await root.dblclick();
  const explorer = app.getByRole("dialog", { name: "Root" }).last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });
  const hiddenToggle = explorer.getByRole("checkbox", { name: "Show hidden files" });
  await expect(hiddenToggle).not.toBeChecked();
  await hiddenToggle.check();
  await expect(explorer.locator("[data-fm-node-id]", { hasText: ".hidden-110.txt" })).toBeVisible();
  await expect(hiddenToggle).toBeChecked();

  await explorer.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
  await root.dblclick();
  const reopened = app.getByRole("dialog", { name: "Root" }).last();
  await expect(reopened.getByRole("checkbox", { name: "Show hidden files" })).toBeChecked();
  await expect(reopened.locator("[data-fm-node-id]", { hasText: ".hidden-110.txt" })).toBeVisible();

  const appFrame = page.frames().find((candidate) => candidate.url().includes("/app/plasmon/"));
  if (!appFrame) throw new Error("Plasmon app frame unavailable for reload boundary");
  await appFrame.reload();
  const reloadedApp = page.frameLocator(frameSelector).first();
  await expect(reloadedApp.locator(".fm-root--desktop")).toBeVisible({ timeout: 30_000 });
  const reloadedRoot = reloadedApp.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(reloadedRoot).toBeVisible();
  await reloadedRoot.dblclick();
  const reloadedExplorer = reloadedApp.getByRole("dialog", { name: "Root" }).last();
  await expect(reloadedExplorer.getByRole("checkbox", { name: "Show hidden files" })).toBeChecked();
  await expect(reloadedExplorer.locator("[data-fm-node-id]", { hasText: ".hidden-110.txt" })).toBeVisible();
});
