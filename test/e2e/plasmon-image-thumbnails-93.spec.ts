import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

test("#93 browser boundary — portrait, landscape and square thumbnails are contained", async ({ page }) => {
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
  ]);

  for (const [name, sourceRatio] of [["portrait.svg", 40 / 120], ["landscape.svg", 120 / 40], ["square.svg", 1]] as const) {
    const entry = explorer.locator("[data-fm-node-id]").filter({ hasText: name }).first();
    await expect(entry).toBeVisible();
    const image = entry.locator(".plasmon-media-thumbnail");
    await expect(image).toBeVisible({ timeout: 10_000 });
    const measured = await image.evaluate((element) => ({
      naturalWidth: (element as HTMLImageElement).naturalWidth,
      naturalHeight: (element as HTMLImageElement).naturalHeight,
      objectFit: getComputedStyle(element).objectFit,
    }));
    expect(measured.naturalWidth).toBeGreaterThan(0);
    expect(measured.naturalHeight).toBeGreaterThan(0);
    expect(measured.objectFit).toBe("contain");
    expect(measured.naturalWidth / measured.naturalHeight).toBeCloseTo(sourceRatio, 2);
    const frame = await image.boundingBox();
    const entryBox = await entry.boundingBox();
    if (!frame || !entryBox) throw new Error(`${name} has no thumbnail bounds`);
    expect(frame.width).toBeLessThanOrEqual(entryBox.width);
    expect(frame.height).toBeLessThanOrEqual(entryBox.height);
  }
});
