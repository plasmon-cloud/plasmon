import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const ORDINARY_NAME = "New folder (2)";
const LONG_NAME = "0123456789".repeat(8);

test("#361 — packaged Desktop rename stays bounded and wraps genuinely long names", async ({ page }) => {
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

    // Exercise creation from the right side of the real packaged Desktop so an
    // accidental workspace-wide editor is caught at the surface where it hurts.
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

    const initialEntryBounds = await entry.boundingBox();
    const initialRenameBounds = await rename.boundingBox();
    const initialOtherBounds = await otherEntry.boundingBox();
    if (!initialEntryBounds || !initialRenameBounds) throw new Error("Rename state has no browser bounds");

    expect(initialRenameBounds.x, "rename left edge").toBeGreaterThanOrEqual(initialEntryBounds.x - 1);
    expect(initialRenameBounds.x + initialRenameBounds.width, "rename right edge")
      .toBeLessThanOrEqual(initialEntryBounds.x + initialEntryBounds.width + 1);
    expect(initialRenameBounds.width, "rename width").toBeLessThanOrEqual(initialEntryBounds.width + 2);

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
      };
    });
    if (!ordinaryBounds) throw new Error("Ordinary rename state has no browser bounds");
    expect(ordinary.textWidth, "New folder (2) fits on one line")
      .toBeLessThanOrEqual(ordinary.contentWidth + 1);
    expect(ordinaryBounds.height, "ordinary filename stays one editor row")
      .toBeLessThanOrEqual(initialRenameBounds.height + 2);
    expect(ordinary.scrollWidth, "ordinary filename does not horizontally overflow")
      .toBeLessThanOrEqual(ordinary.clientWidth + 1);

    await rename.fill(LONG_NAME);
    const longBounds = await rename.boundingBox();
    const longEntryBounds = await entry.boundingBox();
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

    expect(longBounds.width, "long name does not widen rename editor").toBeCloseTo(initialRenameBounds.width, 0);
    expect(longBounds.height, "long name wraps downward inside the bounded editor")
      .toBeGreaterThan(ordinaryBounds.height + 8);
    expect(longMetrics.whiteSpace).toBe("pre-wrap");
    expect(longMetrics.scrollWidth, "long rename does not create horizontal editor overflow")
      .toBeLessThanOrEqual(longMetrics.clientWidth + 1);
    expect(longMetrics.scrollHeight, "long rename has multi-line content")
      .toBeGreaterThan(ordinaryBounds.height);
    expect(longEntryBounds.x, "long name keeps Desktop placement x stable").toBeCloseTo(initialEntryBounds.x, 0);
    expect(longEntryBounds.y, "long name keeps Desktop placement y stable").toBeCloseTo(initialEntryBounds.y, 0);

    if (initialOtherBounds && longOtherBounds) {
      expect(longOtherBounds.x, "neighbor x remains stable").toBeCloseTo(initialOtherBounds.x, 0);
      expect(longOtherBounds.y, "neighbor y remains stable").toBeCloseTo(initialOtherBounds.y, 0);
    }

    await rename.press("Escape");
    await expect(rename).toBeHidden();
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
