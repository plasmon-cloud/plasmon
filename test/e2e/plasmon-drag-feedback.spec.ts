import {
  expect,
  test,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

let resourceSequence = 0;

function uniqueResourceName(kind: "file" | "directory"): string {
  const stem = `drag-resource-${Date.now().toString(36)}-${resourceSequence++}`;
  return kind === "file" ? `${stem}.txt` : stem;
}

function expectNear(actual: number, expected: number, tolerance = 2): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function authenticateAndLaunchPlasmon(page: Page) {
  const runtime = resolveLocalNeutronRuntime();
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
}

async function launchPlasmon(page: Page) {
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

async function createDesktopTextDocument(frame: FrameLocator, files: Locator) {
  const desktopBounds = await files.boundingBox();
  if (!desktopBounds) throw new Error("Desktop FileManager has no browser bounds");
  await files.click({
    button: "right",
    position: {
      x: Math.max(120, Math.floor(desktopBounds.width * 0.55)),
      y: Math.max(120, Math.floor(desktopBounds.height * 0.55)),
    },
  });
  await clickNewContextMenuItem(frame, "New Text Document");
  const rename = frame.getByRole("textbox", { name: /^Rename / });
  await expect(rename).toBeVisible();
  const name = uniqueResourceName("file");
  await rename.fill(name);
  await rename.press("Enter");
  const entry = files.locator('[data-fm-node-id][data-fm-kind="file"]', { hasText: name }).first();
  await expect(entry).toBeVisible();
  const id = await entry.getAttribute("data-fm-node-id");
  if (!id) throw new Error("Created Desktop source has no stable NodeId");
  return { name, id, entry };
}

async function createExplorerResource(files: Locator, kind: "file" | "directory") {
  const toolbar = files.getByRole("toolbar", { name: "File commands" });
  await toolbar.getByRole("button", {
    name: kind === "directory" ? "New Folder" : "New Text Document",
  }).click();
  const rename = files.getByRole("textbox", { name: /^Rename / });
  await expect(rename).toBeVisible();
  const name = uniqueResourceName(kind);
  await rename.fill(name);
  await rename.press("Enter");
  const entry = files.locator(`[data-fm-node-id][data-fm-kind="${kind}"]`, { hasText: name }).first();
  await expect(entry).toBeVisible();
  const id = await entry.getAttribute("data-fm-node-id");
  if (!id) throw new Error(`Created ${kind} has no stable NodeId`);
  return { name, id, entry };
}

async function openRootExplorer(frame: FrameLocator) {
  const root = frame.locator('[data-fm-node-id]', { hasText: "Root" }).first();
  await expect(root).toBeVisible();
  await root.dblclick();
  const active = frame.locator(".plasmon-window-layer [data-window-id].plasmon-window--active").last();
  await expect(active).toBeVisible();
  const windowId = await active.getAttribute("data-window-id");
  if (!windowId) throw new Error("Explorer window has no stable window id");
  const explorer = frame.locator(`[data-window-id="${windowId}"]`);
  const address = explorer.getByRole("textbox", { name: "Address" });
  const explorerFiles = explorer.getByRole("listbox", { name: "Files" });
  await expect(address).toHaveValue("/");
  await expect(explorerFiles).toBeVisible();
  return { explorer, address, explorerFiles };
}

async function navigateExplorerFavorite(
  explorer: Locator,
  address: Locator,
  explorerFiles: Locator,
  name: "Desktop" | "Documents",
  path: "/Desktop" | "/Documents",
) {
  const surface = explorerFiles.locator("[data-fm-directory-id]").first();
  await expect(surface).toBeVisible();
  const before = await surface.getAttribute("data-fm-directory-id");
  if (!before) throw new Error("Explorer FileManager has no directory identity");
  const favorites = explorer.getByRole("complementary", { name: "Favorites" });
  await favorites.getByRole("button", { name, exact: true }).click();
  await expect(address).toHaveValue(path);
  await expect.poll(
    () => explorerFiles.locator("[data-fm-directory-id]").first().getAttribute("data-fm-directory-id"),
  ).not.toBe(before);
  const destination = explorerFiles.locator("[data-fm-directory-id]").first();
  await expect(destination).toBeVisible();
  const id = await destination.getAttribute("data-fm-directory-id");
  if (!id) throw new Error(`${name} FileManager has no directory identity`);
  return { surface: destination, id };
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected visible element has no browser bounds");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function exposeDesktopEntries(
  page: Page,
  iframe: Locator,
  explorer: Locator,
  entries: readonly Locator[],
): Promise<void> {
  let explorerBox = await explorer.boundingBox();
  if (!explorerBox) throw new Error("Explorer window has no browser bounds");
  const entryBoxes = await Promise.all(entries.map((entry) => entry.boundingBox()));
  if (entryBoxes.some((box) => !box)) throw new Error("Desktop source has no browser bounds");
  const concrete = entryBoxes.filter((box): box is NonNullable<typeof box> => box !== null);
  const covered = concrete.some((box) => {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    return x >= explorerBox!.x && x <= explorerBox!.x + explorerBox!.width
      && y >= explorerBox!.y && y <= explorerBox!.y + explorerBox!.height;
  });
  if (!covered) return;

  const titlebar = explorer.locator(".plasmon-window__titlebar");
  const titlebarBox = await titlebar.boundingBox();
  const iframeBox = await iframe.boundingBox();
  if (!titlebarBox || !iframeBox) throw new Error("Cannot expose Desktop source using real window geometry");
  const desiredLeft = Math.max(...concrete.map((box) => box.x + box.width)) + 24;
  const maxRightShift = Math.max(
    0,
    iframeBox.x + iframeBox.width - explorerBox.x - explorerBox.width - 12,
  );
  const shift = Math.min(Math.max(0, desiredLeft - explorerBox.x), maxRightShift);
  if (shift <= 0) throw new Error("Open folder window covers the Desktop source and cannot be moved aside");
  const grabX = titlebarBox.x + Math.min(120, titlebarBox.width / 3);
  const grabY = titlebarBox.y + titlebarBox.height / 2;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + shift, grabY, { steps: 6 });
  await page.mouse.up();

  explorerBox = await explorer.boundingBox();
  if (!explorerBox) throw new Error("Explorer window disappeared while exposing Desktop source");
  for (const entry of entries) {
    const box = await entry.boundingBox();
    if (!box) throw new Error("Desktop source disappeared while exposing it");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const stillCovered = x >= explorerBox.x && x <= explorerBox.x + explorerBox.width
      && y >= explorerBox.y && y <= explorerBox.y + explorerBox.height;
    if (stillCovered) throw new Error("Desktop source remains covered by the open folder window");
  }
}

test("Desktop ghost preserves icon/name geometry, translucency, grab offset, release continuity, and cancel cleanup", async ({ page }) => {
  const { frame, files, health } = await launchPlasmon(page);
  try {
    const source = files.getByRole("option").first();
    await expect(source).toBeVisible();
    const sourceId = await source.getAttribute("data-fm-node-id");
    if (!sourceId) throw new Error("Desktop drag source has no stable NodeId");
    const sourceName = (await source.locator(".fm-entry__name").textContent())?.trim();
    if (!sourceName) throw new Error("Desktop drag source has no visible filename");
    const sourceBox = await source.boundingBox();
    const sourceIconBox = await source.locator(".fm-entry__icon").boundingBox();
    const sourceNameBox = await source.locator(".fm-entry__name").boundingBox();
    if (!sourceBox || !sourceIconBox || !sourceNameBox) {
      throw new Error("Desktop drag source is missing rendered entry geometry");
    }

    // Deliberately grab off-center. The preview must translate the whole source
    // rectangle by the pointer delta rather than re-anchor itself to the cursor.
    const grab = { x: 19, y: 17 };
    const delta = { dx: 8, dy: 8 };
    const start = { x: sourceBox.x + grab.x, y: sourceBox.y + grab.y };
    const end = { x: start.x + delta.dx, y: start.y + delta.dy };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    const previewEntry = preview.locator(".fm-drag-preview__entry");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-fm-drag-source-id", sourceId);
    await expect(previewEntry.locator(".fm-entry__icon")).toBeVisible();
    await expect(previewEntry.locator(".fm-entry__name")).toHaveText(sourceName);
    await expect(preview).toHaveCSS("pointer-events", "none");

    const opacity = await preview.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
    expect(opacity).toBeGreaterThan(0.4);
    expect(opacity).toBeLessThan(1);

    const previewBox = await preview.boundingBox();
    const previewIconBox = await previewEntry.locator(".fm-entry__icon").boundingBox();
    const previewNameBox = await previewEntry.locator(".fm-entry__name").boundingBox();
    if (!previewBox || !previewIconBox || !previewNameBox) {
      throw new Error("Drag preview is missing rendered entry geometry");
    }

    expectNear(previewBox.x, sourceBox.x + delta.dx);
    expectNear(previewBox.y, sourceBox.y + delta.dy);
    expectNear(previewBox.width, sourceBox.width);
    expectNear(previewBox.height, sourceBox.height);
    expectNear(end.x - previewBox.x, grab.x);
    expectNear(end.y - previewBox.y, grab.y);

    // The detached clone must preserve the source entry's internal icon/name
    // arrangement rather than reconstructing a filename-only approximation.
    expectNear(previewIconBox.x - previewBox.x, sourceIconBox.x - sourceBox.x);
    expectNear(previewIconBox.y - previewBox.y, sourceIconBox.y - sourceBox.y);
    expectNear(previewIconBox.width, sourceIconBox.width);
    expectNear(previewIconBox.height, sourceIconBox.height);
    expectNear(previewNameBox.x - previewBox.x, sourceNameBox.x - sourceBox.x);
    expectNear(previewNameBox.y - previewBox.y, sourceNameBox.y - sourceBox.y);
    expectNear(previewNameBox.width, sourceNameBox.width);

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    const committed = files.locator(`[data-fm-node-id="${sourceId}"]`);
    await expect(committed).toBeVisible();
    const committedBox = await committed.boundingBox();
    if (!committedBox) throw new Error("Committed Desktop entry has no browser bounds");
    expectNear(committedBox.x, previewBox.x, 4);
    expectNear(committedBox.y, previewBox.y, 4);

    // Escape is a first-class cancel path and must restore the source entry and
    // remove the detached preview instead of leaving body-level drag residue.
    const cancelBox = await committed.boundingBox();
    if (!cancelBox) throw new Error("Committed Desktop entry disappeared before cancel coverage");
    await page.mouse.move(cancelBox.x + 20, cancelBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(cancelBox.x + 31, cancelBox.y + 20, { steps: 4 });
    await expect(preview).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(committed).not.toHaveClass(/is-dragging/);
    expect(await committed.evaluate((element) => (element as HTMLElement).style.pointerEvents)).toBe("");
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("Desktop item moves into an already-open folder window", async ({ page }) => {
  const { frame, iframe, files, health } = await launchPlasmon(page);
  try {
    const source = await createDesktopTextDocument(frame, files);
    const { explorer, address, explorerFiles } = await openRootExplorer(frame);
    const destination = await navigateExplorerFavorite(
      explorer,
      address,
      explorerFiles,
      "Documents",
      "/Documents",
    );
    await exposeDesktopEntries(page, iframe, explorer, [source.entry]);

    const sourcePoint = await centerOf(source.entry);
    const dropPoint = await centerOf(destination.surface);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(dropPoint.x, dropPoint.y, { steps: 10 });

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__icon")).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__name")).toHaveText(source.name);
    await expect(destination.surface).toHaveClass(/is-drop-target/);
    await expect(preview).toHaveAttribute("data-fm-drop-target-id", destination.id);
    await expect(preview.locator('[data-fm-drag-feedback="true"]')).toHaveText("Move to Documents");

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(files.locator(`[data-fm-node-id="${source.id}"]`)).toHaveCount(0);
    await expect(explorerFiles.locator(`[data-fm-node-id="${source.id}"]`)).toBeVisible();
    await expect(address).toHaveValue("/Documents");
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("target feedback changes A to B to invalid and invalid, cancel, and unmount paths clear drag state", async ({ page }) => {
  const { frame, health } = await launchPlasmon(page);
  try {
    const { explorer, address, explorerFiles } = await openRootExplorer(frame);
    await navigateExplorerFavorite(explorer, address, explorerFiles, "Desktop", "/Desktop");

    const targetA = await createExplorerResource(explorerFiles, "directory");
    const targetB = await createExplorerResource(explorerFiles, "directory");
    const source = await createExplorerResource(explorerFiles, "file");
    const invalidFile = await createExplorerResource(explorerFiles, "file");

    const sourcePoint = await centerOf(source.entry);
    const targetAPoint = await centerOf(targetA.entry);
    const targetBPoint = await centerOf(targetB.entry);
    const invalidPoint = await centerOf(invalidFile.entry);
    const preview = frame.locator('[data-fm-drag-preview="true"]');
    const feedback = preview.locator('[data-fm-drag-feedback="true"]');

    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetAPoint.x, targetAPoint.y, { steps: 8 });
    await expect(preview).toHaveAttribute("data-fm-drop-target-id", targetA.id);
    await expect(feedback).toHaveText(`Move to ${targetA.name}`);
    await expect(targetA.entry).toHaveClass(/is-drop-target/);

    await page.mouse.move(targetBPoint.x, targetBPoint.y, { steps: 8 });
    await expect(preview).toHaveAttribute("data-fm-drop-target-id", targetB.id);
    await expect(feedback).toHaveText(`Move to ${targetB.name}`);
    await expect(targetA.entry).not.toHaveClass(/is-drop-target/);
    await expect(targetB.entry).toHaveClass(/is-drop-target/);

    // A normal file is an invalid directory target and deliberately blocks the
    // containing FileManager surface. Stale target B feedback must disappear.
    await page.mouse.move(invalidPoint.x, invalidPoint.y, { steps: 8 });
    await expect(feedback).toBeHidden();
    expect(await preview.getAttribute("data-fm-drop-target-id")).toBeNull();
    await expect(targetB.entry).not.toHaveClass(/is-drop-target/);

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(source.entry).toBeVisible();
    await expect(invalidFile.entry).toBeVisible();

    // Cancel after a valid target has been established must clear both the body
    // preview and the target highlight.
    const sourcePointAfterInvalidDrop = await centerOf(source.entry);
    await page.mouse.move(sourcePointAfterInvalidDrop.x, sourcePointAfterInvalidDrop.y);
    await page.mouse.down();
    await page.mouse.move(targetAPoint.x, targetAPoint.y, { steps: 8 });
    await expect(feedback).toHaveText(`Move to ${targetA.name}`);
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(targetA.entry).not.toHaveClass(/is-drop-target/);
    await expect(source.entry).not.toHaveClass(/is-dragging/);

    // Finally prove the hook unmount cleanup itself. The native Close button is
    // invoked through its real DOM handler while pointer capture is active because
    // a physical second click cannot occur while the first pointer remains down.
    const sourcePointBeforeUnmount = await centerOf(source.entry);
    await page.mouse.move(sourcePointBeforeUnmount.x, sourcePointBeforeUnmount.y);
    await page.mouse.down();
    await page.mouse.move(targetAPoint.x, targetAPoint.y, { steps: 8 });
    await expect(preview).toBeVisible();
    await explorer.getByRole("button", { name: "Close" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(explorer).toHaveCount(0);
    await expect(preview).toHaveCount(0);
    await page.mouse.up();
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("multi-selection keeps a recognizable grouped preview and moves the selected group", async ({ page }) => {
  const { frame, iframe, files, health } = await launchPlasmon(page);
  try {
    const first = await createDesktopTextDocument(frame, files);
    const second = await createDesktopTextDocument(frame, files);
    const { explorer, address, explorerFiles } = await openRootExplorer(frame);
    const destination = await navigateExplorerFavorite(
      explorer,
      address,
      explorerFiles,
      "Documents",
      "/Documents",
    );
    await exposeDesktopEntries(page, iframe, explorer, [first.entry, second.entry]);

    await first.entry.click();
    await second.entry.click({ modifiers: ["Control"] });
    await expect(first.entry).toHaveAttribute("aria-selected", "true");
    await expect(second.entry).toHaveAttribute("aria-selected", "true");

    const sourcePoint = await centerOf(second.entry);
    const destinationPoint = await centerOf(destination.surface);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(destinationPoint.x, destinationPoint.y, { steps: 10 });

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-fm-drag-count", "2");
    await expect(preview.locator(".fm-drag-preview__count")).toHaveText("2");
    await expect(preview.locator(".fm-drag-preview__entry")).toHaveCount(1);
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__icon")).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__name")).toHaveText(second.name);
    await expect(preview.locator('[data-fm-drag-feedback="true"]')).toHaveText("Move to Documents");
    await expect(preview).toHaveCSS("pointer-events", "none");

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(files.locator(`[data-fm-node-id="${first.id}"]`)).toHaveCount(0);
    await expect(files.locator(`[data-fm-node-id="${second.id}"]`)).toHaveCount(0);
    await expect(explorerFiles.locator(`[data-fm-node-id="${first.id}"]`)).toBeVisible();
    await expect(explorerFiles.locator(`[data-fm-node-id="${second.id}"]`)).toBeVisible();
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