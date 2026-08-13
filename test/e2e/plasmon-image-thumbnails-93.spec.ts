import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#93 browser boundary — portrait, landscape and square thumbnails are contained", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl], allow: [] });
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
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible();
  await rootShortcut.dblclick();
  const explorer = app.getByRole("dialog", { name: "Root" }).last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });

  const input = explorer.locator('input[type="file"]');
  await input.setInputFiles([
    { name: "portrait.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="120"><rect width="40" height="120" fill="red"/></svg>') },
    { name: "landscape.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="green"/></svg>') },
    { name: "square.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="blue"/></svg>') },
    { name: "very-wide.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="30"><rect width="240" height="30" fill="purple"/></svg>') },
    { name: "very-tall.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="240"><rect width="30" height="240" fill="orange"/></svg>') },
  ]);

  for (const [name, sourceRatio] of [["portrait.svg", 40 / 120], ["landscape.svg", 120 / 40], ["square.svg", 1], ["very-wide.svg", 240 / 30], ["very-tall.svg", 30 / 240]] as const) {
    const entry = explorer.locator("[data-fm-node-id]").filter({ hasText: name }).first();
    await expect(entry).toBeVisible();
    const frame = entry.locator(".plasmon-icon-frame--thumbnail");
    const image = entry.locator(".plasmon-media-thumbnail");
    await expect(frame).toBeVisible({ timeout: 10_000 });
    await expect(image).toBeVisible({ timeout: 10_000 });
    const measured = await image.evaluate((element) => ({
      naturalWidth: (element as HTMLImageElement).naturalWidth,
      naturalHeight: (element as HTMLImageElement).naturalHeight,
      rendered: (() => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
    }));
    expect(measured.naturalWidth).toBeGreaterThan(0);
    expect(measured.naturalHeight).toBeGreaterThan(0);
    expect(measured.naturalWidth).toBeGreaterThan(0);
    expect(measured.naturalHeight).toBeGreaterThan(0);
    expect(measured.naturalWidth / measured.naturalHeight).toBeCloseTo(sourceRatio, 2);
    const frameBox = await frame.boundingBox();
    const entryBox = await entry.boundingBox();
    if (!frameBox || !entryBox) throw new Error(`${name} has no thumbnail bounds`);
    expect(measured.rendered.x).toBeGreaterThanOrEqual(frameBox.x - 1);
    expect(measured.rendered.y).toBeGreaterThanOrEqual(frameBox.y - 1);
    expect(measured.rendered.x + measured.rendered.width).toBeLessThanOrEqual(frameBox.x + frameBox.width + 1);
    expect(measured.rendered.y + measured.rendered.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
    expect(measured.rendered.width / measured.rendered.height).toBeCloseTo(sourceRatio, 1);
    expect(frameBox.width).toBeLessThanOrEqual(entryBox.width);
    expect(frameBox.height).toBeLessThanOrEqual(entryBox.height);
    await entry.click();
    await expect(entry).toHaveAttribute("aria-selected", "true");
  }
});
