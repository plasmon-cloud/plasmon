import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

async function authenticateAndLaunchPlasmon(page: import("@playwright/test").Page) {
  const runtime = resolveLocalNeutronRuntime();
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
}

async function launchPlasmon(page: import("@playwright/test").Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  await page.goto(kernelUrl);
  await authenticateAndLaunchPlasmon(page);
  const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
  const iframe = page.locator(selector).first();
  const frame = page.frameLocator(selector).first();
  const files = frame.getByRole("listbox", { name: "Files" }).first();
  await expect(files).toBeVisible({ timeout: 30_000 });
  return { frame, iframe, files, health };
}

test("#360 Desktop drag ghost preserves entry identity and lands where it previews", async ({ page }) => {
  const { frame, files, health } = await launchPlasmon(page);
  try {
    const source = files.getByRole("option").first();
    await expect(source).toBeVisible();
    const sourceId = await source.getAttribute("data-fm-node-id");
    if (!sourceId) throw new Error("Desktop drag source has no stable NodeId");
    const sourceName = (await source.locator(".fm-entry__name").textContent())?.trim();
    if (!sourceName) throw new Error("Desktop drag source has no visible filename");
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Desktop drag source has no browser bounds");

    // r2 Desktop slots have a 12px horizontal and 16px vertical gap around
    // the 92x88 entry footprint. An 8px/8px move is large enough to establish
    // a drag while remaining a valid free position, so placement reconciliation
    // should not legitimately move the entry somewhere else.
    const dx = 8;
    const dy = 8;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + dx,
      sourceBox.y + sourceBox.height / 2 + dy,
      { steps: 6 },
    );

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-fm-drag-source-id", sourceId);
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__icon")).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__name")).toHaveText(sourceName);
    await expect(preview).toHaveCSS("pointer-events", "none");

    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error("Desktop drag preview has no browser bounds");
    expect(Math.abs(previewBox.x - (sourceBox.x + dx))).toBeLessThanOrEqual(2);
    expect(Math.abs(previewBox.y - (sourceBox.y + dy))).toBeLessThanOrEqual(2);

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    const committed = files.locator(`[data-fm-node-id="${sourceId}"]`);
    await expect(committed).toBeVisible();
    const committedBox = await committed.boundingBox();
    if (!committedBox) throw new Error("Committed Desktop entry has no browser bounds");
    expect(Math.abs(committedBox.x - previewBox.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(committedBox.y - previewBox.y)).toBeLessThanOrEqual(4);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("#360 Desktop item moves into an already-open folder window", async ({ page }) => {
  const { frame, iframe, files, health } = await launchPlasmon(page);
  try {
    // Create the source directly through the production Desktop FileManager path.
    // This is the same packaged setup used by the broad refactor smoke and keeps
    // #360 focused on the subsequent cross-window pointer/drop contract instead
    // of depending on unrelated cross-FileManager refresh or remount behavior.
    const desktopBounds = await files.boundingBox();
    if (!desktopBounds) throw new Error("Desktop FileManager has no browser bounds");
    await files.click({
      button: "right",
      position: {
        x: Math.max(120, Math.floor(desktopBounds.width * 0.55)),
        y: Math.max(120, Math.floor(desktopBounds.height * 0.55)),
      },
    });
    await frame.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
    const rename = frame.getByRole("textbox", { name: /^Rename New Text Document/ });
    await expect(rename).toBeVisible();
    const createdName = await rename.inputValue();
    await rename.press("Enter");
    const source = files.locator('[data-fm-node-id][data-fm-kind="file"]', { hasText: createdName }).first();
    await expect(source).toBeVisible();
    const sourceId = await source.getAttribute("data-fm-node-id");
    if (!sourceId) throw new Error("Created Desktop source has no stable NodeId");

    const root = frame.locator('[data-fm-node-id]', { hasText: "Root" }).first();
    await expect(root).toBeVisible();
    await root.dblclick();

    // Leave a real Explorer window open on Documents. Its FileManager content
    // surface, not a Documents entry in the source FileManager, must become the
    // canonical target for the real Desktop drag.
    const explorer = frame.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(explorer).toHaveCount(1);
    const address = explorer.getByRole("textbox", { name: "Address" });
    await expect(address).toHaveValue("/");
    const explorerFiles = explorer.getByRole("listbox", { name: "Files" });
    const rootSurface = explorerFiles.locator("[data-fm-directory-id]").first();
    await expect(rootSurface).toBeVisible();
    const rootDirectoryId = await rootSurface.getAttribute("data-fm-directory-id");
    if (!rootDirectoryId) throw new Error("Root FileManager has no directory identity");

    const favorites = explorer.getByRole("complementary", { name: "Favorites" });
    await favorites.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(address).toHaveValue("/Documents");
    await expect.poll(
      () => explorerFiles.locator("[data-fm-directory-id]").first().getAttribute("data-fm-directory-id"),
    ).not.toBe(rootDirectoryId);
    const destinationSurface = explorerFiles.locator("[data-fm-directory-id]").first();
    await expect(destinationSurface).toBeVisible();
    const destinationId = await destinationSurface.getAttribute("data-fm-directory-id");
    if (!destinationId) throw new Error("Open Documents FileManager has no directory identity");

    let sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Desktop source has no browser bounds");
    let explorerBox = await explorer.boundingBox();
    if (!explorerBox) throw new Error("Explorer window has no browser bounds");
    const sourceCenter = () => ({
      x: sourceBox!.x + sourceBox!.width / 2,
      y: sourceBox!.y + sourceBox!.height / 2,
    });
    const coveredByExplorer = () => {
      const point = sourceCenter();
      return point.x >= explorerBox!.x && point.x <= explorerBox!.x + explorerBox!.width
        && point.y >= explorerBox!.y && point.y <= explorerBox!.y + explorerBox!.height;
    };

    // Default placement normally leaves the left Desktop column exposed. If the
    // opened Explorer covers this newly-created icon, move the real window just
    // enough to expose it instead of bypassing Windowing or dispatching events.
    if (coveredByExplorer()) {
      const titlebar = explorer.locator(".plasmon-window__titlebar");
      const titlebarBox = await titlebar.boundingBox();
      const iframeBox = await iframe.boundingBox();
      if (!titlebarBox || !iframeBox) throw new Error("Cannot expose Desktop source using real window geometry");
      const desiredLeft = sourceBox.x + sourceBox.width + 24;
      const maxRightShift = Math.max(0, iframeBox.x + iframeBox.width - explorerBox.x - explorerBox.width - 12);
      const shift = Math.min(Math.max(0, desiredLeft - explorerBox.x), maxRightShift);
      if (shift <= 0) throw new Error("Open folder window covers the Desktop source and cannot be moved aside");
      await page.mouse.move(titlebarBox.x + Math.min(120, titlebarBox.width / 3), titlebarBox.y + titlebarBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        titlebarBox.x + Math.min(120, titlebarBox.width / 3) + shift,
        titlebarBox.y + titlebarBox.height / 2,
        { steps: 6 },
      );
      await page.mouse.up();
      sourceBox = await source.boundingBox();
      explorerBox = await explorer.boundingBox();
      if (!sourceBox || !explorerBox || coveredByExplorer()) {
        throw new Error("Desktop source remains covered by the open folder window");
      }
    }

    const destinationBox = await destinationSurface.boundingBox();
    if (!destinationBox) throw new Error("Open Documents content surface has no browser bounds");
    const dropPoint = {
      x: destinationBox.x + destinationBox.width / 2,
      y: destinationBox.y + destinationBox.height / 2,
    };

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dropPoint.x, dropPoint.y, { steps: 10 });

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__icon")).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__name")).toHaveText(createdName);
    await expect(destinationSurface).toHaveClass(/is-drop-target/);
    await expect(preview).toHaveAttribute("data-fm-drop-target-id", destinationId);
    await expect(preview.locator('[data-fm-drag-feedback="true"]')).toHaveText("Move to Documents");

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(files.locator(`[data-fm-node-id="${sourceId}"]`)).toHaveCount(0);
    await expect(explorerFiles.locator(`[data-fm-node-id="${sourceId}"]`)).toBeVisible();
    await expect(address).toHaveValue("/Documents");
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
