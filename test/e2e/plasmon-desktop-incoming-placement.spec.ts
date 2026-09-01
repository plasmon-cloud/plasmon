import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";

async function launchPlasmon(page: import("@playwright/test").Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

  const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
  const frame = page.frameLocator(selector).first();
  const desktopFiles = frame.getByRole("listbox", { name: "Files" }).first();
  await expect(desktopFiles).toBeVisible({ timeout: 30_000 });
  return { frame, desktopFiles, health };
}

function containsPoint(
  box: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
  margin = 0,
): boolean {
  return point.x >= box.x - margin
    && point.x <= box.x + box.width + margin
    && point.y >= box.y - margin
    && point.y <= box.y + box.height + margin;
}

test("Explorer to Desktop drop commits the icon where the ghost is released", async ({ page }) => {
  const { frame, desktopFiles, health } = await launchPlasmon(page);
  try {
    const root = frame.locator('[data-fm-node-id]', { hasText: "Root" }).first();
    await expect(root).toBeVisible();
    await root.dblclick();

    const explorer = frame.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(explorer).toHaveCount(1);
    const explorerFiles = explorer.getByRole("listbox", { name: "Files" });
    const address = explorer.getByRole("textbox", { name: "Address" });
    const favorites = explorer.getByRole("complementary", { name: "Favorites" });
    await favorites.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(address).toHaveValue("/Documents");

    await chooseFileManagerBackgroundAction(explorerFiles, "New Text Document");
    const rename = explorerFiles.getByRole("textbox", { name: /^Rename New Text Document/ });
    await expect(rename).toBeVisible();
    const sourceName = await rename.inputValue();
    await rename.press("Enter");

    const source = explorerFiles.locator('[data-fm-node-id][data-fm-kind="file"]', { hasText: sourceName }).first();
    await expect(source).toBeVisible();
    const sourceId = await source.getAttribute("data-fm-node-id");
    if (!sourceId) throw new Error("Explorer drag source has no stable NodeId");

    const desktopSurface = desktopFiles.locator("[data-fm-directory-id]").first();
    await expect(desktopSurface).toBeVisible();
    const desktopId = await desktopSurface.getAttribute("data-fm-directory-id");
    if (!desktopId) throw new Error("Desktop FileManager has no directory identity");

    const sourceBox = await source.boundingBox();
    const desktopBox = await desktopSurface.boundingBox();
    const explorerBox = await explorer.boundingBox();
    if (!sourceBox || !desktopBox || !explorerBox) throw new Error("Required drag geometry is unavailable");

    const desktopEntryBoxes = await desktopFiles.getByRole("option").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    const candidatePoints = [
      { x: desktopBox.x + desktopBox.width - 170, y: desktopBox.y + desktopBox.height - 150 },
      { x: desktopBox.x + desktopBox.width - 170, y: desktopBox.y + 150 },
      { x: desktopBox.x + desktopBox.width * 0.72, y: desktopBox.y + desktopBox.height * 0.72 },
      { x: desktopBox.x + desktopBox.width * 0.72, y: desktopBox.y + desktopBox.height * 0.28 },
    ];
    const dropPoint = candidatePoints.find((point) => (
      !containsPoint(explorerBox, point, 8)
      && !desktopEntryBoxes.some((box) => containsPoint(box, point, 55))
    ));
    if (!dropPoint) throw new Error("No exposed free Desktop point is available for the #371 drag");

    const grab = {
      x: sourceBox.x + sourceBox.width * 0.32,
      y: sourceBox.y + sourceBox.height * 0.38,
    };
    const grabOffset = {
      x: grab.x - sourceBox.x,
      y: grab.y - sourceBox.y,
    };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(dropPoint.x, dropPoint.y, { steps: 12 });

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-fm-drag-source-id", sourceId);
    await expect(preview).toHaveAttribute("data-fm-drop-target-id", desktopId);
    await expect(preview.locator('[data-fm-drag-feedback="true"]')).toHaveText("Move to Desktop");
    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error("Incoming Desktop drag ghost has no browser bounds");

    expect(Math.abs((dropPoint.x - previewBox.x) - grabOffset.x)).toBeLessThanOrEqual(2);
    expect(Math.abs((dropPoint.y - previewBox.y) - grabOffset.y)).toBeLessThanOrEqual(2);

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(explorerFiles.locator(`[data-fm-node-id="${sourceId}"]`)).toHaveCount(0);

    const committed = desktopFiles.locator(`[data-fm-node-id="${sourceId}"]`);
    await expect(committed).toBeVisible();
    const committedBox = await committed.boundingBox();
    if (!committedBox) throw new Error("Committed incoming Desktop entry has no browser bounds");

    expect(Math.abs(committedBox.x - previewBox.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(committedBox.y - previewBox.y)).toBeLessThanOrEqual(4);
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
