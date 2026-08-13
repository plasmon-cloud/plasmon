import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#66 RED — active multi-selection drag preview is above windows and transparent to hit testing", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    expect(principal).toBe(runtime.developerIdentityPrincipal);
    await page.locator('[data-tid="launcher-open"]').click();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
    const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    const iframe = page.locator(selector).first();
    const frame = page.frameLocator(selector).first();
    const files = frame.getByRole("listbox", { name: "Files" }).first();
    await expect(files).toBeVisible({ timeout: 30_000 });

    // Open a real native Explorer window so the drag crosses an actual window
    // stack rather than a synthetic div.
    const root = frame.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(root).toBeVisible();
    await root.dblclick();
    const explorer = frame.getByRole("dialog", { name: "Root" }).last();
    await expect(explorer).toBeVisible({ timeout: 15_000 });
    const windowBox = await explorer.boundingBox();
    if (!windowBox) throw new Error("Explorer window has no browser bounds");

    const entries = files.getByRole("option");
    expect(await entries.count()).toBeGreaterThanOrEqual(2);
    await entries.nth(0).click();
    await entries.nth(1).click({ modifiers: ["Control"] });
    expect(await entries.nth(0).getAttribute("aria-selected")).toBe("true");
    expect(await entries.nth(1).getAttribute("aria-selected")).toBe("true");

    const source = await entries.nth(0).boundingBox();
    if (!source) throw new Error("Selected Desktop entry has no bounds");
    const point = { x: windowBox.x + windowBox.width / 2, y: windowBox.y + 24 };
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 8 });

    const preview = frame.locator('[data-fm-drag-preview]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-fm-drag-count", "2");
    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error("Drag preview has no browser bounds");
    expect(previewBox.x).toBeLessThan(windowBox.x + windowBox.width);
    expect(previewBox.x + previewBox.width).toBeGreaterThan(windowBox.x);
    expect(previewBox.y).toBeLessThan(windowBox.y + windowBox.height);
    expect(previewBox.y + previewBox.height).toBeGreaterThan(windowBox.y);

    const frameBox = await iframe.boundingBox();
    if (!frameBox) throw new Error("Plasmon iframe has no browser bounds");
    const localPoint = { x: point.x - frameBox.x, y: point.y - frameBox.y };
    // Temporarily make only the preview hit-testable to prove it is visually
    // above the native window without asserting a z-index number, then restore
    // pointer transparency and prove normal hit testing reaches the window.
    const stackProbe = await preview.evaluate((element, location) => {
      const previous = element instanceof HTMLElement ? element.style.pointerEvents : "";
      if (element instanceof HTMLElement) element.style.pointerEvents = "auto";
      const top = document.elementFromPoint(location.x, location.y);
      if (element instanceof HTMLElement) element.style.pointerEvents = previous;
      return top === element || element.contains(top);
    }, localPoint);
    expect(stackProbe).toBe(true);
    await expect(preview).toHaveCSS("pointer-events", "none");
    const underlying = await frame.locator("html").evaluate((_, location) => {
      const element = document.elementFromPoint(location.x, location.y);
      return element?.closest("[data-window-id]")?.getAttribute("data-window-id") ?? null;
    }, localPoint);
    expect(underlying).not.toBeNull();

    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(files.locator(".is-dragging")).toHaveCount(0);

    // A real drop on an Explorer directory must still reach that owner; the
    // preview is not allowed to become the drop target.
    const destination = explorer.locator("[data-fm-node-id]").filter({ hasText: "Documents" }).first();
    await expect(destination).toBeVisible();
    const destinationBox = await destination.boundingBox();
    if (!destinationBox) throw new Error("Explorer destination has no bounds");
    const sourceId = await entries.nth(0).getAttribute("data-fm-node-id");
    if (!sourceId) throw new Error("Dragged source has no stable NodeId");
    const refreshedSource = await entries.nth(0).boundingBox();
    if (!refreshedSource) throw new Error("Entry disappeared after cancel");
    await page.mouse.move(refreshedSource.x + 20, refreshedSource.y + 20);
    await page.mouse.down();
    await page.mouse.move(destinationBox.x + destinationBox.width / 2, destinationBox.y + destinationBox.height / 2, { steps: 8 });
    await expect(destination).toHaveClass(/is-drop-target/);
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(files.locator(`[data-fm-node-id="${sourceId}"]`)).toHaveCount(0);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global { interface Window { __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>; } }
