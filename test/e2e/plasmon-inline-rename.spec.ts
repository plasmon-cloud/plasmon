import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const ORDINARY_NAME = "New folder (2)";
const ORDINARY_DISPLAY_NAME = "New Folder (1)";
const LONG_NAME = "0123456789".repeat(8);

test("— packaged Desktop filename and rename surfaces stay tile-bounded", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #361; the gate still exercises the packaged FileEntry",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const plasmonSelector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(plasmonSelector)).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector);
    const desktop = plasmon.getByRole("listbox", { name: "Files" }).first();
    await expect(desktop).toBeVisible();

    const desktopBounds = await desktop.boundingBox();
    if (!desktopBounds) throw new Error("Desktop FileManager has no browser bounds");

    // Create through the real Desktop path near an edge. The owning entry and
    // its neighbor must keep their placement while rename presentation grows.
    await desktop.click({
      button: "right",
      position: {
        x: Math.max(1, Math.floor(desktopBounds.width - 24)),
        y: Math.max(96, Math.floor(desktopBounds.height * 0.35)),
      },
    });
    await clickNewContextMenuItem(plasmon, "New Folder");

    const rename = plasmon.getByRole("textbox", { name: /^Rename New Folder/ });
    await expect(rename).toBeVisible();
    const entry = rename.locator("xpath=ancestor::div[@data-fm-node-id][1]");
    const otherEntry = desktop.locator('[data-fm-node-id]').filter({ hasNot: rename }).first();

    const initialNodeId = await entry.getAttribute("data-fm-node-id");
    const initialEntryBounds = await entry.boundingBox();
    const initialRenameBounds = await rename.boundingBox();
    const initialOtherBounds = await otherEntry.boundingBox();
    if (!initialNodeId || !initialEntryBounds || !initialRenameBounds) {
      throw new Error("Rename state has no stable identity/browser bounds");
    }

    const stableEntry = desktop.locator(`[data-fm-node-id="${initialNodeId}"]`);
    await expect(stableEntry).toHaveCount(1);
    expect(initialRenameBounds.x, "rename starts inside its FileEntry left edge")
      .toBeGreaterThanOrEqual(initialEntryBounds.x - 1);
    expect(initialRenameBounds.x + initialRenameBounds.width, "rename starts inside its FileEntry right edge")
      .toBeLessThanOrEqual(initialEntryBounds.x + initialEntryBounds.width + 1);
    expect(initialRenameBounds.width, "short rename starts narrower than the tile cap")
      .toBeLessThan(initialEntryBounds.width - 1);

    await rename.fill(ORDINARY_NAME);
    const ordinaryBounds = await rename.boundingBox();
    const ordinary = await rename.evaluate((input) => {
      const element = input as HTMLTextAreaElement;
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas text measurement unavailable");
      context.font = style.font;
      const horizontalChrome = Number.parseFloat(style.paddingLeft)
        + Number.parseFloat(style.paddingRight)
        + Number.parseFloat(style.borderLeftWidth)
        + Number.parseFloat(style.borderRightWidth);
      const borderInline = Number.parseFloat(style.borderLeftWidth)
        + Number.parseFloat(style.borderRightWidth);
      return {
        contentWidth: element.getBoundingClientRect().width - horizontalChrome,
        textWidth: context.measureText(element.value).width,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        offsetWidth: element.offsetWidth,
        borderInline,
        overflowY: style.overflowY,
        textAlign: style.textAlign,
      };
    });
    if (!ordinaryBounds) throw new Error("Ordinary rename state has no browser bounds");

    expect(ordinary.textWidth, "New folder (2) fits on one line")
      .toBeLessThanOrEqual(ordinary.contentWidth + 1);
    expect(ordinaryBounds.height, "New folder (2) stays at the one-row editor height")
      .toBeLessThanOrEqual(initialRenameBounds.height + 2);
    expect(ordinaryBounds.width, "ordinary rename grows but stays inside the tile")
      .toBeLessThanOrEqual(initialEntryBounds.width + 1);
    expect(ordinaryBounds.width, "ordinary rename does not shrink from its initial width")
      .toBeGreaterThanOrEqual(initialRenameBounds.width - 1);
    expect(ordinary.scrollWidth, "ordinary rename has no horizontal overflow")
      .toBeLessThanOrEqual(ordinary.clientWidth + 1);
    expect(ordinary.overflowY, "ordinary rename has no vertical scrollbar").toBe("hidden");
    expect(
      ordinary.offsetWidth - ordinary.clientWidth - ordinary.borderInline,
      "ordinary rename has no scrollbar-width strip on the right",
    ).toBeLessThanOrEqual(1);
    expect(ordinary.textAlign, "Desktop rename text is centered").toBe("center");

    await rename.fill(LONG_NAME);
    const longBounds = await rename.boundingBox();
    const longEntryBounds = await stableEntry.boundingBox();
    const longOtherBounds = await otherEntry.boundingBox();
    const longMetrics = await rename.evaluate((input) => {
      const element = input as HTMLTextAreaElement;
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        whiteSpace: getComputedStyle(element).whiteSpace,
        overflowY: getComputedStyle(element).overflowY,
      };
    });
    if (!longBounds || !longEntryBounds) throw new Error("Long rename state has no browser bounds");

    expect(longBounds.x, "long rename remains inside its FileEntry left edge")
      .toBeGreaterThanOrEqual(longEntryBounds.x - 1);
    expect(longBounds.x + longBounds.width, "long rename remains inside its FileEntry right edge")
      .toBeLessThanOrEqual(longEntryBounds.x + longEntryBounds.width + 1);
    expect(longBounds.width, "long rename grows to the bounded tile width")
      .toBeGreaterThan(initialRenameBounds.width + 4);
    expect(longBounds.width).toBeGreaterThanOrEqual(ordinaryBounds.width - 1);
    expect(longBounds.height, "long rename wraps downward")
      .toBeGreaterThan(ordinaryBounds.height + 8);
    expect(longMetrics.whiteSpace).toBe("pre-wrap");
    expect(longMetrics.overflowY, "long tiled rename does not introduce a scrollbar gutter").toBe("hidden");
    expect(longMetrics.scrollWidth, "long rename has no horizontal editor overflow")
      .toBeLessThanOrEqual(longMetrics.clientWidth + 1);
    expect(longMetrics.scrollHeight, "long rename contains multiple wrapped rows")
      .toBeGreaterThan(ordinaryBounds.height);
    expect(await stableEntry.getAttribute("data-fm-node-id"), "rename keeps NodeId stable").toBe(initialNodeId);
    expect(longEntryBounds.x, "long rename keeps Desktop placement x stable")
      .toBeCloseTo(initialEntryBounds.x, 0);
    expect(longEntryBounds.y, "long rename keeps Desktop placement y stable")
      .toBeCloseTo(initialEntryBounds.y, 0);
    if (initialOtherBounds && longOtherBounds) {
      expect(longOtherBounds.x, "neighbor x remains stable").toBeCloseTo(initialOtherBounds.x, 0);
      expect(longOtherBounds.y, "neighbor y remains stable").toBeCloseTo(initialOtherBounds.y, 0);
    }

    await rename.press("Escape");
    await expect(rename).toBeHidden();
    expect(await stableEntry.getAttribute("data-fm-node-id"), "cancel keeps NodeId stable").toBe(initialNodeId);

    // Commit the exact ordinary filename from human review so normal, selected,
    // and F2 states all exercise the same real resource/name.
    await stableEntry.click({ button: "right" });
    await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "Rename" }).click();
    const committedRename = plasmon.getByRole("textbox", { name: /^Rename New Folder/ });
    await expect(committedRename).toBeVisible();
    await committedRename.fill(ORDINARY_DISPLAY_NAME);
    await committedRename.press("Enter");
    await expect(committedRename).toBeHidden();
    expect(await stableEntry.getAttribute("data-fm-node-id"), "commit keeps NodeId stable").toBe(initialNodeId);

    // Selected New Folder (1): exactly one rendered text line inside the tile.
    const selectedName = stableEntry.locator(".fm-entry__expanded-name");
    await expect(selectedName).toBeVisible();
    await expect(selectedName).toHaveText(ORDINARY_DISPLAY_NAME);
    const selectedEntryBounds = await stableEntry.boundingBox();
    const selectedNameBounds = await selectedName.boundingBox();
    if (!selectedEntryBounds || !selectedNameBounds) throw new Error("Selected filename has no browser bounds");
    expect(selectedNameBounds.x).toBeGreaterThanOrEqual(selectedEntryBounds.x - 1);
    expect(selectedNameBounds.x + selectedNameBounds.width)
      .toBeLessThanOrEqual(selectedEntryBounds.x + selectedEntryBounds.width + 1);

    const selectedMetrics = await selectedName.evaluate((element) => {
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(element);
      const textRect = range.getBoundingClientRect();
      return {
        lineCount: range.getClientRects().length,
        textTop: textRect.top,
        pointerEvents: style.pointerEvents,
      };
    });
    expect(selectedMetrics.lineCount, "selected New Folder (1) is exactly one rendered line").toBe(1);
    expect(selectedMetrics.pointerEvents).toBe("none");

    // F2 New Folder (1): same one-row editor height as the proven ordinary
    // rename above, centered in place, and with no scrollbar-width gutter.
    await stableEntry.press("F2");
    const inPlaceRename = plasmon.getByRole("textbox", { name: `Rename ${ORDINARY_DISPLAY_NAME}` });
    await expect(inPlaceRename).toBeVisible();
    const inPlaceBounds = await inPlaceRename.boundingBox();
    const inPlaceMetrics = await inPlaceRename.evaluate((element) => {
      const style = getComputedStyle(element);
      const borderInline = Number.parseFloat(style.borderLeftWidth)
        + Number.parseFloat(style.borderRightWidth);
      return {
        textAlign: style.textAlign,
        overflowY: style.overflowY,
        clientWidth: element.clientWidth,
        offsetWidth: element.offsetWidth,
        borderInline,
      };
    });
    if (!inPlaceBounds) throw new Error("F2 rename has no browser bounds");
    expect(inPlaceBounds.height, "F2 New Folder (1) is exactly the one-row editor height")
      .toBeLessThanOrEqual(ordinaryBounds.height + 1);
    expect(inPlaceMetrics.textAlign).toBe("center");
    expect(inPlaceMetrics.overflowY, "F2 New Folder (1) has no vertical scrollbar").toBe("hidden");
    expect(
      inPlaceMetrics.offsetWidth - inPlaceMetrics.clientWidth - inPlaceMetrics.borderInline,
      "F2 New Folder (1) has no scrollbar-width strip on the right",
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(inPlaceBounds.y - selectedNameBounds.y), "F2 rename keeps the selected label vertical anchor")
      .toBeLessThanOrEqual(1);
    const selectedCenterX = selectedNameBounds.x + (selectedNameBounds.width / 2);
    const renameCenterX = inPlaceBounds.x + (inPlaceBounds.width / 2);
    expect(Math.abs(renameCenterX - selectedCenterX), "F2 rename remains centered on the filename")
      .toBeLessThanOrEqual(1);
    await inPlaceRename.press("Escape");
    await expect(inPlaceRename).toBeHidden();

    // Normal New Folder (1): exactly one rendered text line with no ellipsis,
    // and selection must not make that text jump vertically.
    await desktop.click({
      position: {
        x: Math.max(1, Math.floor(desktopBounds.width * 0.5)),
        y: Math.max(1, Math.floor(desktopBounds.height - 12)),
      },
    });
    await expect(selectedName).toHaveCount(0);
    const collapsedName = stableEntry.locator(".fm-entry__name");
    await expect(collapsedName).toHaveText(ORDINARY_DISPLAY_NAME);
    const collapsedMetrics = await collapsedName.evaluate((element) => {
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(element);
      const textRect = range.getBoundingClientRect();
      return {
        lineCount: range.getClientRects().length,
        textTop: textRect.top,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
      };
    });
    expect(collapsedMetrics.lineCount, "normal New Folder (1) is exactly one rendered line").toBe(1);
    expect(collapsedMetrics.scrollWidth, "normal New Folder (1) is not truncated")
      .toBeLessThanOrEqual(collapsedMetrics.clientWidth + 1);
    expect(collapsedMetrics.whiteSpace).toBe("nowrap");
    expect(collapsedMetrics.textOverflow).toBe("ellipsis");
    expect(Math.abs(collapsedMetrics.textTop - selectedMetrics.textTop), "selection does not move the filename text")
      .toBeLessThanOrEqual(1);

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
