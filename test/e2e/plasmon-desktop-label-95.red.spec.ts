import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

test("#95 RED — selected Desktop labels expand readably without moving icon geometry", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator("[data-tid=launcher-open]").click();
  await page.locator("[data-tid=launcher-tile-plasmon-main]").click();
  const app = page.frameLocator('iframe[data-app-id="plasmon"][data-tile-id="main"]').first();
  const desktop = app.locator(".fm-root--desktop");
  await expect(desktop).toBeVisible({ timeout: 30_000 });
  const desktopBox = await desktop.boundingBox();
  if (!desktopBox) throw new Error("Desktop has no bounds");
  await desktop.click({ button: "right", position: { x: Math.max(120, desktopBox.width / 2), y: Math.max(120, desktopBox.height / 2) }});
  await app.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
  const rename = app.getByRole("textbox", { name: "Rename New Text Document.txt" });
  const longName = "A deliberately long Desktop filename that must remain readable near an edge.txt";
  await rename.fill(longName);
  await rename.press("Enter");
  const entry = app.locator("[data-fm-node-id]").filter({ hasText: longName }).first();
  await expect(entry).toBeVisible();
  const sibling = desktop.locator("[data-fm-node-id]").filter({ hasNotText: longName }).first();
  const entryBefore = await entry.boundingBox();
  const siblingBefore = await sibling.boundingBox();
  if (!entryBefore || !siblingBefore) throw new Error("Desktop geometry unavailable");
  await expect(entry.locator(".fm-entry__expanded-name")).toHaveCount(0);
  await expect(entry.locator(".fm-entry__name")).toHaveCSS("text-overflow", "ellipsis");

  await entry.click();
  const expanded = entry.locator(".fm-entry__expanded-name");
  await expect(expanded).toBeVisible();
  const expandedBox = await expanded.boundingBox();
  const selectedBox = await entry.boundingBox();
  const siblingSelected = await sibling.boundingBox();
  if (!expandedBox || !selectedBox || !siblingSelected) throw new Error("Selected label geometry unavailable");
  expect(expandedBox.width).toBeGreaterThan(selectedBox.width + 40);
  for (const [actual, expected] of [[selectedBox, entryBefore], [siblingSelected, siblingBefore]] as const) {
    expect(Math.abs(actual.x - expected.x)).toBeLessThan(1);
    expect(Math.abs(actual.y - expected.y)).toBeLessThan(1);
    expect(Math.abs(actual.width - expected.width)).toBeLessThan(1);
    expect(Math.abs(actual.height - expected.height)).toBeLessThan(1);
  }
  expect(expandedBox.x).toBeGreaterThanOrEqual(desktopBox.x);
  expect(expandedBox.x + expandedBox.width).toBeLessThanOrEqual(desktopBox.x + desktopBox.width);
  expect(await expanded.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  const siblingBoxes = await desktop.locator("[data-fm-node-id]").evaluateAll((nodes, selectedName) => nodes
    .filter((node) => node.textContent?.includes(selectedName as string) !== true)
    .map((node) => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }), longName);
  const overlap = siblingBoxes.some((box) => expandedBox.left < box.right && expandedBox.right > box.left && expandedBox.top < box.bottom && expandedBox.bottom > box.top);
  expect(overlap, "the readable label must exercise sibling layering").toBe(true);
  const expandedHit = await expanded.evaluate((node) => {
    const previous = node instanceof HTMLElement ? node.style.pointerEvents : "";
    if (node instanceof HTMLElement) node.style.pointerEvents = "auto";
    const box = node.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (node instanceof HTMLElement) node.style.pointerEvents = previous;
    return top === node || node.contains(top);
  });
  expect(expandedHit).toBe(true);

  // The same selected entry is moved to the right edge without changing its
  // persisted icon footprint; its readable overlay must remain contained.
  const drag = await entry.boundingBox();
  if (!drag) throw new Error("Selected entry has no drag bounds");
  await page.mouse.move(drag.x + drag.width / 2, drag.y + 24);
  await page.mouse.down();
  await page.mouse.move(desktopBox.x + desktopBox.width - 45, drag.y + 24, { steps: 8 });
  await page.mouse.up();
  await expect(expanded).toBeVisible();
  const rightEntry = await entry.boundingBox();
  const rightExpanded = await expanded.boundingBox();
  if (!rightEntry || !rightExpanded) throw new Error("Right-edge label geometry unavailable");
  expect(rightExpanded.x).toBeGreaterThanOrEqual(desktopBox.x);
  expect(rightExpanded.x + rightExpanded.width).toBeLessThanOrEqual(desktopBox.x + desktopBox.width);
  expect(rightEntry.width).toBeCloseTo(entryBefore.width, 1);

  // #191's rename editor remains a separate bounded surface, not the #95
  // selected-label overlay contract.
  await desktop.focus();
  await desktop.press("F2");
  const editor = app.getByRole("textbox", { name: `Rename ${longName}` });
  await expect(editor).toBeVisible();
  const editorBox = await editor.boundingBox();
  if (!editorBox) throw new Error("Rename editor has no bounds");
  expect(editorBox.x).toBeGreaterThanOrEqual(desktopBox.x);
  expect(editorBox.x + editorBox.width).toBeLessThanOrEqual(desktopBox.x + desktopBox.width);
  await editor.press("Escape");
});
