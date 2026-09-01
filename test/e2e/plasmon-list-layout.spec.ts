import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("— List flows compact entries across columns and navigates spatially", async ({ page }) => {
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
  await clickNewContextMenuItem(app, "New Text Document");
  await app.getByRole("textbox", { name: "Rename New Text Document.txt" }).press("Escape");
  const root = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(root).toBeVisible();
  await root.dblclick();
  const explorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });

  await explorer.getByRole("combobox", { name: /^View/ }).selectOption("list");
  const list = explorer.getByRole("listbox", { name: "Files" });
  await expect(list).toBeVisible();
  const entries = list.getByRole("option");
  expect(await entries.count()).toBeGreaterThanOrEqual(4);
  const boxes = [] as Array<{ x: number; y: number; width: number; height: number }>;
  for (let index = 0; index < await entries.count(); index += 1) {
    const box = await entries.nth(index).boundingBox();
    if (!box) throw new Error(`List entry ${index} has no browser bounds`);
    boxes.push(box);
  }
  const rootBox = await list.boundingBox();
  if (!rootBox) throw new Error("List view has no browser bounds");
  const distinctColumns = [...new Set(boxes.map((box) => Math.round(box.x)))];
  expect(distinctColumns.length).toBeGreaterThan(1);
  expect(Math.max(...boxes.map((box) => box.width))).toBeLessThan(rootBox.width * 0.75);
  expect(Math.min(...boxes.map((box) => box.width))).toBeGreaterThan(120);

  // The first entry's right neighbor is determined by actual rendered geometry,
  // not by an implementation-specific index. ArrowRight must focus an entry
  // in a later rendered column; Details remains a metadata-column surface.
  const first = entries.nth(0);
  await first.click();
  const firstBox = boxes[0]!;
  await list.press("ArrowRight");
  const focused = list.locator("[data-fm-node-id].is-focused").first();
  await expect(focused).toBeVisible();
  const focusedBox = await focused.boundingBox();
  if (!focusedBox) throw new Error("Spatially focused List entry has no bounds");
  expect(focusedBox.x).toBeGreaterThan(firstBox.x + 20);

  await explorer.getByRole("combobox", { name: /^View/ }).selectOption("details");
  const details = explorer.getByRole("listbox", { name: "Files" });
  await expect(details.locator(".fm-details-head")).toBeVisible();
  const detailEntry = details.getByRole("option").first();
  const detailBox = await detailEntry.boundingBox();
  if (!detailBox) throw new Error("Details entry has no browser bounds");
  expect(detailBox.width).toBeGreaterThan(rootBox.width * 0.75);
});