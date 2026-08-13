import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("packaged Plasmon boots its real tile and protects native desktop workflows", async ({ page, request }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  let monacoLifecycleActive = false;
  page.on("pageerror", (error) => {
    // Monaco/VS Code cancellation tokens can surface the expected `Canceled`
    // rejection while the editor is loading, active, or tearing down. Scope
    // that exact exception to the real Monaco lifecycle exercised below;
    // every other page error remains fatal to the packaged golden path.
    if (monacoLifecycleActive && error.message === "Canceled") return;
    pageErrors.push(error.message);
  });

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await expect(page.locator('[data-tid="launcher-open"]')).toBeVisible();

  const registryResponse = await request.get(new URL("/system/apps.json", kernelUrl).href);
  expect(registryResponse.ok()).toBe(true);
  const registry = await registryResponse.json() as Record<string, {
    version?: number;
    tiles?: Array<{ id?: string; path?: string }>;
  }>;
  expect(registry[APP_ID]?.version).toBe(100);
  expect(registry[APP_ID]?.tiles).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: TILE_ID, path: "index.html" })]),
  );

  for (const path of [
    `/app/${APP_ID}/index.html`,
    `/app/${APP_ID}/monaco-workers/editor.worker.js`,
  ]) {
    const response = await request.get(new URL(path, kernelUrl).href);
    expect(response.ok(), `${path} should be served from the installed package`).toBe(true);
  }

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const frame = page.locator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(frame).toBeVisible();
  const source = await frame.getAttribute("src");
  expect(source).not.toBeNull();
  expect(new URL(source!).pathname.startsWith(`/app/${APP_ID}/`)).toBe(true);

  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  await expect(app.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(app.getByRole("button", { name: "Search" })).toBeVisible();

  // Issue #95 browser boundary: normal Desktop names remain compact, while
  // selected/focused names use a pointer-inert overlay that stays inside the
  // workspace without changing the icon entry's fixed collision geometry.
  const desktopFiles = app.locator(".fm-root--desktop").first();
  await expect(desktopFiles).toBeVisible({ timeout: 30_000 });
  const desktopBounds = await desktopFiles.boundingBox();
  if (!desktopBounds) throw new Error("Desktop FileManager has no browser bounds");

  await desktopFiles.click({
    button: "right",
    position: {
      x: Math.max(120, Math.floor(desktopBounds.width * 0.55)),
      y: Math.max(120, Math.floor(desktopBounds.height * 0.55)),
    },
  });
  const desktopMenu = app.getByRole("menu").last();
  await desktopMenu.getByRole("menuitem", { name: "New Text Document" }).click();
  const initialDesktopRename = app.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await expect(initialDesktopRename).toBeVisible();
  const longDesktopName = "Quarterly planning notes with a deliberately long desktop filename for bounded selection.txt";
  await initialDesktopRename.fill(longDesktopName);
  await initialDesktopRename.press("Enter");

  const longDesktopEntry = app.locator(".fm-entry--desktop", { hasText: longDesktopName }).first();
  await expect(longDesktopEntry).toBeVisible();

  await desktopFiles.click({
    position: {
      x: Math.max(8, desktopBounds.width - 12),
      y: Math.max(8, desktopBounds.height - 12),
    },
  });
  await expect(longDesktopEntry.locator(".fm-entry__expanded-name")).toHaveCount(0);
  const compactNameStyle = await longDesktopEntry.locator(".fm-entry__name").evaluate((element) => {
    const style = getComputedStyle(element);
    return { overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
  });
  expect(compactNameStyle).toEqual({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

  const compactEntryBox = await longDesktopEntry.boundingBox();
  if (!compactEntryBox) throw new Error("Long Desktop entry has no compact bounds");
  await longDesktopEntry.click({ position: { x: compactEntryBox.width / 2, y: 24 } });
  const expandedName = longDesktopEntry.locator(".fm-entry__expanded-name");
  await expect(expandedName).toBeVisible();
  const selectedEntryBox = await longDesktopEntry.boundingBox();
  const leftExpandedBox = await expandedName.boundingBox();
  if (!selectedEntryBox || !leftExpandedBox) throw new Error("Selected Desktop filename has no browser bounds");

  expect(Math.abs(selectedEntryBox.x - compactEntryBox.x)).toBeLessThan(0.5);
  expect(Math.abs(selectedEntryBox.y - compactEntryBox.y)).toBeLessThan(0.5);
  expect(Math.abs(selectedEntryBox.width - compactEntryBox.width)).toBeLessThan(0.5);
  expect(leftExpandedBox.width).toBeGreaterThan(selectedEntryBox.width + 80);
  expect(leftExpandedBox.x).toBeGreaterThanOrEqual(desktopBounds.x + 7);
  expect(leftExpandedBox.x + leftExpandedBox.width).toBeLessThanOrEqual(desktopBounds.x + desktopBounds.width - 7);
  expect(await expandedName.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

  await desktopFiles.focus();
  await desktopFiles.press("F2");
  const boundedRename = app.getByRole("textbox", { name: `Rename ${longDesktopName}` });
  await expect(boundedRename).toBeVisible();
  const renameBox = await boundedRename.boundingBox();
  if (!renameBox) throw new Error("Desktop rename input has no browser bounds");
  expect(renameBox.width).toBeGreaterThan(selectedEntryBox.width + 80);
  expect(renameBox.x).toBeGreaterThanOrEqual(desktopBounds.x + 7);
  expect(renameBox.x + renameBox.width).toBeLessThanOrEqual(desktopBounds.x + desktopBounds.width - 7);
  await boundedRename.press("Escape");

  const dragStart = await longDesktopEntry.boundingBox();
  if (!dragStart) throw new Error("Desktop entry has no drag origin bounds");
  await page.mouse.move(dragStart.x + dragStart.width / 2, dragStart.y + 24);
  await page.mouse.down();
  await page.mouse.move(desktopBounds.x + desktopBounds.width - 46, dragStart.y + 24, { steps: 8 });
  await page.mouse.up();

  await expect(expandedName).toBeVisible();
  const rightEntryBox = await longDesktopEntry.boundingBox();
  const rightExpandedBox = await expandedName.boundingBox();
  if (!rightEntryBox || !rightExpandedBox) throw new Error("Right-edge Desktop filename has no browser bounds");
  expect(rightEntryBox.x).toBeGreaterThan(compactEntryBox.x + 80);
  expect(Math.abs(rightEntryBox.width - compactEntryBox.width)).toBeLessThan(0.5);
  expect(rightExpandedBox.x).toBeGreaterThanOrEqual(desktopBounds.x + 7);
  expect(rightExpandedBox.x + rightExpandedBox.width).toBeLessThanOrEqual(desktopBounds.x + desktopBounds.width - 7);

  // Issue #45 visible boundary: use the real packaged Shell/native process path
  // to launch Recycle Bin and prove its first-class native surface renders.
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByLabel("Search Plasmon");
  await expect(search).toBeVisible();
  await search.fill("Recycle Bin");
  const recycleResult = app.locator("[data-search-result]", { hasText: "Recycle Bin" }).first();
  await expect(recycleResult).toBeVisible({ timeout: 15_000 });
  await recycleResult.click();

  const recycleBin = app.getByRole("dialog", { name: "Recycle Bin" });
  await expect(recycleBin).toBeVisible({ timeout: 10_000 });
  await expect(recycleBin.getByText("Recycle Bin is empty.")).toBeVisible();
  await expect(recycleBin.getByRole("button", { name: "Empty Recycle Bin" })).toBeDisabled();

  const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
  const initialWindowCount = await nativeWindows.count();
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();

  await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });
  const dialog = nativeWindows.last();
  await expect(dialog).toBeVisible();

  // Issue #108 visible boundary: folder activation and toolbar Back/Forward must
  // reach the same production navigation model in the real packaged Explorer.
  const explorerAddress = dialog.getByRole("textbox", { name: "Address" });
  await expect(explorerAddress).toHaveValue("/");
  const documentsEntry = dialog.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
  await expect(documentsEntry).toBeVisible();
  await documentsEntry.dblclick();
  await expect(explorerAddress).toHaveValue("/Documents");

  const back = dialog.getByRole("button", { name: "Back" });
  const forward = dialog.getByRole("button", { name: "Forward" });
  await expect(back).toBeEnabled();
  await back.click();
  await expect(explorerAddress).toHaveValue("/");
  await expect(forward).toBeEnabled();
  await forward.click();
  await expect(explorerAddress).toHaveValue("/Documents");
  await back.click();
  await expect(explorerAddress).toHaveValue("/");

  const titlebar = dialog.locator(".plasmon-window__titlebar");
  const workspace = await app.locator(".plasmon-window-layer").first().boundingBox();
  if (!workspace) throw new Error("Plasmon WindowLayer has no browser bounds");

  const dragTitlebarTo = async (clientX: number): Promise<void> => {
    const box = await titlebar.boundingBox();
    if (!box) throw new Error("Native window titlebar has no browser bounds");
    const titlebarY = box.y + Math.min(16, box.height / 2);
    await page.mouse.move(box.x + Math.min(120, box.width / 2), titlebarY);
    await page.mouse.down();
    await page.mouse.move(clientX, titlebarY, { steps: 5 });
    await page.mouse.up();
  };

  await dragTitlebarTo(workspace.x + 1);
  await expect(dialog).toHaveAttribute("data-window-snap", "left");

  await dragTitlebarTo(workspace.x + workspace.width - 1);
  await expect(dialog).toHaveAttribute("data-window-snap", "right");

  // Issue #42 visible boundary: create/open a real filesystem document through
  // Explorer, dirty the packaged Monaco editor, and use the real native Close
  // control. Save/discard/failure semantics stay in deterministic Native Apps
  // tests; Playwright protects only the rendered close-request interaction.
  await dialog.getByRole("button", { name: "New Text Document" }).click();
  const renameDocument = dialog.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await expect(renameDocument).toBeVisible();
  await renameDocument.press("Escape");

  const textEntry = dialog.locator("[data-fm-node-id]", { hasText: "New Text Document.txt" }).first();
  await expect(textEntry).toBeVisible();
  monacoLifecycleActive = true;
  await textEntry.dblclick();

  const editorWindow = app.getByRole("dialog", { name: "New Text Document.txt" }).last();
  await expect(editorWindow).toBeVisible({ timeout: 20_000 });
  const editorSurface = editorWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
  await expect(editorSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });

  await editorSurface.click({ position: { x: 120, y: 80 } });
  await page.keyboard.type("dirty close proof");
  await expect(editorWindow.getByText("Modified", { exact: true })).toBeVisible();

  const closeEditor = editorWindow.locator(".plasmon-window__controls").getByRole("button", { name: "Close" });
  await closeEditor.click();
  const closePrompt = editorWindow.getByRole("alertdialog", { name: "Save changes to New Text Document.txt?" });
  await expect(closePrompt).toBeVisible({ timeout: 5_000 });
  await expect(closePrompt.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(closePrompt.getByRole("button", { name: "Discard" })).toBeVisible();
  await closePrompt.getByRole("button", { name: "Cancel" }).click();
  await expect(closePrompt).not.toBeVisible();
  await expect(editorWindow).toBeVisible();

  // Dirty it again so the second close remains deterministic even if autosave
  // had time to run after Cancel.
  await editorSurface.click({ position: { x: 120, y: 80 } });
  await page.keyboard.type(" again");
  await expect(editorWindow.getByText("Modified", { exact: true })).toBeVisible();
  await closeEditor.click();
  await expect(closePrompt).toBeVisible({ timeout: 5_000 });
  await closePrompt.getByRole("button", { name: "Discard" }).click();
  await expect(app.getByRole("dialog", { name: "New Text Document.txt" })).toHaveCount(0, { timeout: 10_000 });

  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
