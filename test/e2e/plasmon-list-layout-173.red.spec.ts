import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("#173 RED — List is a compact spatial column view distinct from Details", async ({ page }) => {
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
  const desktopBox = await desktop.boundingBox();
  if (!desktopBox) throw new Error("Desktop FileManager has no bounds");
  await desktop.click({ button: "right", position: { x: Math.max(120, desktopBox.width / 2), y: Math.max(120, desktopBox.height / 2) }});
  await app.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
  await app.getByRole("textbox", { name: "Rename New Text Document.txt" }).press("Escape");
  const root = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(root).toBeVisible();
  await root.dblclick();
  const explorer = app.getByRole("dialog", { name: "Root" }).last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });

  const view = explorer.getByLabel("View");
  await view.selectOption("list");
  const listRoot = explorer.locator(".fm-root--list");
  await expect(listRoot).toBeVisible();
  const listBox = await listRoot.boundingBox();
  const listEntry = listRoot.locator(".fm-entry--list").first();
  const listEntryBox = await listEntry.boundingBox();
  if (!listBox || !listEntryBox) throw new Error("List view has no measurable entry");
  expect(listEntryBox.width).toBeGreaterThan(listBox.width * 0.75);
  expect(listEntry.locator(".fm-entry__name")).toHaveCSS("text-align", "left");

  // List is a single vertical compact column: horizontal arrows must not use
  // the generic linear next-item policy. Details remains a metadata-column
  // layout and shares the same resource/selection semantics.
  const entries = listRoot.locator(".fm-entry--list");
  expect(await entries.count()).toBeGreaterThan(1);
  await entries.first().click();
  await listRoot.press("ArrowRight");
  await expect(entries.first()).toHaveClass(/is-focused/);
  await expect(entries.nth(1)).not.toHaveClass(/is-focused/);

  await view.selectOption("details");
  const detailsRoot = explorer.locator(".fm-root--details");
  await expect(detailsRoot).toBeVisible();
  await expect(detailsRoot.locator(".fm-details-head")).toBeVisible();
  const detailsEntry = detailsRoot.locator(".fm-entry--details").first();
  const detailsBox = await detailsEntry.boundingBox();
  if (!detailsBox) throw new Error("Details view has no measurable entry");
  expect(detailsBox.width).toBeGreaterThan(listEntryBox.width - 1);
});
