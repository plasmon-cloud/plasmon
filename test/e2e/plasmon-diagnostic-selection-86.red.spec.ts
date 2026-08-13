import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("#86 browser boundary — diagnostic text selects without stealing FileEntry drag", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator("[data-tid=launcher-open]").click();
  await page.locator(`[data-tid=launcher-tile-${APP_ID}-${TILE_ID}]`).click();
  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.locator(".fm-root--desktop")).toBeVisible({ timeout: 30_000 });
  const desktop = app.locator(".fm-root--desktop");
  const box = await desktop.boundingBox();
  if (!box) throw new Error("Desktop has no bounds");
  await desktop.click({ button: "right", position: { x: Math.max(120, box.width / 2), y: Math.max(120, box.height / 2) });
  await app.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
  await app.getByRole("textbox", { name: "Rename New Text Document.txt" }).press("Escape");
  const root = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await root.dblclick();
  const explorer = app.getByRole("dialog", { name: "Root" }).last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });

  const address = explorer.getByRole("textbox", { name: "Address" });
  await address.fill("/does-not-exist-for-selection-86");
  await address.press("Enter");
  const diagnostic = explorer.locator(".fm-error-banner").last();
  await expect(diagnostic).toBeVisible();
  const diagnosticText = await diagnostic.locator("span").innerText();
  expect(diagnosticText.length).toBeGreaterThan(8);

  const diagnosticBox = await diagnostic.boundingBox();
  if (!diagnosticBox) throw new Error("Diagnostic banner has no bounds");
  await page.mouse.move(diagnosticBox.x + 8, diagnosticBox.y + diagnosticBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(diagnosticBox.x + Math.max(40, diagnosticBox.width - 40), diagnosticBox.y + diagnosticBox.height / 2, { steps: 6 });
  await page.mouse.up();
  const selectedText = await explorer.locator("body").evaluate(() => window.getSelection()?.toString() ?? "");
  expect(selectedText).toContain(diagnosticText.slice(0, Math.min(12, diagnosticText.length)));
  expect(await explorer.locator(".is-dragging").count()).toBe(0);

  await address.fill("/");
  await address.press("Enter");
  const entry = explorer.locator("[data-fm-node-id]").filter({ hasText: "New Text Document.txt" }).first();
  await expect(entry).toBeVisible();
  const entryBox = await entry.boundingBox();
  if (!entryBox) throw new Error("FileEntry has no bounds");
  await page.mouse.move(entryBox.x + entryBox.width / 2, entryBox.y + entryBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(entryBox.x + entryBox.width / 2 + 24, entryBox.y + entryBox.height / 2 + 24, { steps: 5 });
  await expect(entry).toHaveClass(/is-dragging/);
  await page.mouse.up();
});
