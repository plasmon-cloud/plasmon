import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const ORDINARY_NAME = "New folder (2)";
const ORDINARY_DISPLAY_NAME = "New Folder (1)";
const LONG_NAME = "0123456789".repeat(8);

test("#361 — packaged Desktop filename and rename surfaces stay tile-bounded", async ({ page }) => {
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

    // Exercise the real Desktop creation path from an edge-adjacent context
    // location. Placement stays authoritative while every filename surface
    // must remain inside the owning Desktop tile horizontally.
    await desktop.click({
      button: "right",
      position: {
        x: Math.max(1, Math.floor(desktopBounds.width - 24)),
        y: Math.max(96, Math.floor(desktopBounds.height * 0.35)),
      },
    });
    await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "New Folder" }).click();

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
      return {
        contentWidth: element.getBoundingClientRect().width - horizontalChrome,
        textWidth: context.measureText(element.value).width,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        textAlign: style.textAlign,
      };
    });
    if (!ordinaryBounds) throw new Error("Ordinary rename state has no browser bounds");
    expect(ordinary.textWidth, "New folder (2) fits on one line")
      .toBeLessThanOrEqual(ordinary.contentWidth + 1);
    expect(ordinaryBounds.height, "ordinary filename stays one editor row")
      .toBeLessThanOrEqual(initialRenameBounds.height + 2);
    expect(ordinaryBounds.width, "ordinary filename may grow but stays inside the tile")
      .toBeLessThanOrEqual(initialEntryBounds.width + 1);
    expect(ordinaryBounds.width, "ordinary filename does not shrink from the shorter initial value")
      .toBeGreaterThanOrEqual(initialRenameBounds.width - 1);
    expect(ordinary.scrollWidth, "ordinary filename does not horizontally overflow")
      .toBeLessThanOrEqual(ordinary.clientWidth + 1);
    expect(ordinary.textAlign, "Desktop rename text stays visually centered in place").toBe("center");

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
      };
    });
    if (!longBounds || !longEntryBounds) throw new Error("Long rename state has no browser bounds");

    expect(longBounds.x, "long rename remains inside its FileEntry left edge")
      .toBeGreaterThanOrEqual(longEntryBounds.x - 1);
    expect(longBounds.x + longBounds.width, "long rename remains inside its FileEntry right edge")
      .toBeLessThanOrEqual(longEntryBounds.x + longEntryBounds.width + 1);
    expect(longBounds.width, "long name grows to the bounded tile width rather than workspace width")
      .toBeGreaterThan(initialRenameBounds.width + 4);
    expect(longBounds.width).toBeGreaterThanOrEqual(ordinaryBounds.width - 1);
    expect(longBounds.height, "long name wraps downward inside the bounded editor")
      .toBeGreaterThan(ordinaryBounds.height + 8);
    expect(longMetrics.whiteSpace).toBe("pre-wrap");
    expect(longMetrics.scrollWidth, "long rename does not create horizontal editor overflow")
      .toBeLessThanOrEqual(longMetrics.clientWidth + 1);
    expect(longMetrics.scrollHeight, "long rename has multi-line content")
      .toBeGreaterThan(ordinaryBounds.height);
    expect(await stableEntry.getAttribute("data-fm-node-id"), "rename keeps NodeId stable").toBe(initialNodeId);
    expect(longEntryBounds.x, "long name keeps Desktop placement x stable").toBeCloseTo(initialEntryBounds.x, 0);
    expect(longEntryBounds.y, "long name keeps Desktop placement y stable").toBeCloseTo(initialEntryBounds.y, 0);

    if (initialOtherBounds && longOtherBounds) {
      expect(longOtherBounds.x, "neighbor x remains stable").toBeCloseTo(initialOtherBounds.x, 0);
      expect(longOtherBounds.y, "neighbor y remains stable").toBeCloseTo(initialOtherBounds.y, 0);
    }

    await rename.press("Escape");
    await expect(rename).toBeHidden();
    await expect(stableEntry).toBeVisible();
    expect(await stableEntry.getAttribute("data-fm-node-id"), "cancel keeps NodeId stable").toBe(initialNodeId);

    // Exercise a second real rename session and commit the exact ordinary name
    // called out by human review. Read-only assertions below therefore inspect
    // the actual rendered filename rather than a hypothetical string width.
    await stableEntry.click({ button: "right" });
    await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "Rename" }).click();
    const committedRename = plasmon.getByRole("textbox", { name: /^Rename New Folder/ });
    await expect(committedRename).toBeVisible();
    await committedRename.fill(ORDINARY_DISPLAY_NAME);
    await committedRename.press("Enter");
    await expect(committedRename).toBeHidden();
    expect(await stableEntry.getAttribute("data-fm-node-id"), "commit keeps NodeId stable").toBe(initialNodeId);

    // Human-review boundary: selection must not recreate the old 260px-wide
    // Desktop filename field. The selected overlay remains pointer-inert but
    // is horizontally bounded to the same tile.
    const selectedName = stableEntry.locator(".fm-entry__expanded-name");
    await expect(selectedName).toBeVisible();
    await expect(selectedName).toHaveText(ORDINARY_DISPLAY_NAME);
    const selectedEntryBounds = await stableEntry.boundingBox();
    const selectedNameBounds = await selectedName.boundingBox();
    if (!selectedEntryBounds || !selectedNameBounds) throw new Error("Selected filename has no browser bounds");
    expect(selectedNameBounds.x, "selected filename stays inside tile left edge")
      .toBeGreaterThanOrEqual(selectedEntryBounds.x - 1);
    expect(selectedNameBounds.x + selectedNameBounds.width, "selected filename stays inside tile right edge")
      .toBeLessThanOrEqual(selectedEntryBounds.x + selectedEntryBounds.width + 1);

    const selectedMetrics = await selectedName.evaluate((element) => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas text measurement unavailable");
      context.font = style.font;
      const horizontalChrome = Number.parseFloat(style.paddingLeft)
        + Number.parseFloat(style.paddingRight)
        + Number.parseFloat(style.borderLeftWidth)
        + Number.parseFloat(style.borderRightWidth);
      const range = document.createRange();
      range.selectNodeContents(element);
      const textRect = range.getBoundingClientRect();
      return {
        contentWidth: element.getBoundingClientRect().width - horizontalChrome,
        textWidth: context.measureText(element.textContent ?? "").width,
        textTop: textRect.top,
        whiteSpace: style.whiteSpace,
        overflowWrap: style.overflowWrap,
        pointerEvents: style.pointerEvents,
      };
    });
    expect(selectedMetrics.textWidth, "New Folder (1) fits the selected tile label without horizontal expansion")
      .toBeLessThanOrEqual(selectedMetrics.contentWidth + 1);
    expect(selectedMetrics.whiteSpace).toBe("normal");
    expect(selectedMetrics.overflowWrap).toBe("anywhere");
    expect(selectedMetrics.pointerEvents).toBe("none");

    // F2 should feel like editing the selected filename in place. The bounded
    // editor keeps the selected label's vertical anchor and remains centered;
    // only genuinely long content transitions into multiline growth.
    await stableEntry.press("F2");
    const inPlaceRename = plasmon.getByRole("textbox", { name: `Rename ${ORDINARY_DISPLAY_NAME}` });
    await expect(inPlaceRename).toBeVisible();
    const inPlaceBounds = await inPlaceRename.boundingBox();
    const inPlaceMetrics = await inPlaceRename.evaluate((element) => ({
      textAlign: getComputedStyle(element).textAlign,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }));
    if (!inPlaceBounds) throw new Error("F2 rename has no browser bounds");
    expect(inPlaceMetrics.textAlign, "F2 Desktop rename remains centered like the label it replaces").toBe("center");
    expect(inPlaceMetrics.whiteSpace).toBe("pre-wrap");
    expect(Math.abs(inPlaceBounds.y - selectedNameBounds.y), "F2 rename keeps the selected label's vertical anchor")
      .toBeLessThanOrEqual(1);
    const selectedCenterX = selectedNameBounds.x + (selectedNameBounds.width / 2);
    const renameCenterX = inPlaceBounds.x + (inPlaceBounds.width / 2);
    expect(Math.abs(renameCenterX - selectedCenterX), "F2 rename remains horizontally centered on the filename")
      .toBeLessThanOrEqual(1);
    await inPlaceRename.press("Escape");
    await expect(inPlaceRename).toBeHidden();
    await expect(selectedName).toBeVisible();

    // Unselected labels use the same compact tile boundary. Assert the real
    // committed filename is fully present and does not overflow into ellipsis.
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
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas text measurement unavailable");
      context.font = style.font;
      const range = document.createRange();
      range.selectNodeContents(element);
      const textRect = range.getBoundingClientRect();
      return {
        contentWidth: element.getBoundingClientRect().width,
        textWidth: context.measureText(element.textContent ?? "").width,
        textTop: textRect.top,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
      };
    });
    expect(collapsedMetrics.textWidth, "New Folder (1) fits the unselected Desktop label")
      .toBeLessThanOrEqual(collapsedMetrics.contentWidth + 1);
    expect(collapsedMetrics.scrollWidth, "New Folder (1) is not visually truncated")
      .toBeLessThanOrEqual(collapsedMetrics.clientWidth + 1);
    expect(collapsedMetrics.whiteSpace).toBe("nowrap");
    expect(collapsedMetrics.textOverflow).toBe("ellipsis");
    expect(Math.abs(collapsedMetrics.textTop - selectedMetrics.textTop), "selection does not make the filename jump vertically")
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