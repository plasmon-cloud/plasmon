import { mkdir } from "node:fs/promises";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { activateLocalPlaywrightIdentity } from "./local-playwright-identity.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const PLASMON_FRAME = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
const PLASMON_BACKGROUND = `iframe[data-tid="app-background-frame"][data-app-id="${APP_ID}"]`;

function chromiumLaunchOptions(): { executablePath?: string; args?: string[] } {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const args = process.env.PLAYWRIGHT_CHROMIUM_ARGS?.split(/\s+/).filter(Boolean) ?? [];
  return {
    ...(executablePath ? { executablePath } : {}),
    ...(args.length > 0 ? { args } : {}),
  };
}

async function launchPersistentProfile(userDataDir: string): Promise<BrowserContext> {
  await mkdir(userDataDir, { recursive: true });
  return await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    ...chromiumLaunchOptions(),
  });
}

async function firstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? await context.newPage();
}

async function activateKernelPage(page: Page, kernelUrl: string): Promise<void> {
  const runtime = resolveLocalNeutronRuntime();
  if (page.url() !== kernelUrl) await page.goto(kernelUrl);
  await activateLocalPlaywrightIdentity(
    page,
    runtime.developerIdentitySeed,
    runtime.developerIdentityPrincipal,
  );
  await expect(page.locator('[data-tid="launcher-open"]')).toBeVisible();
  await expect(page.locator(PLASMON_BACKGROUND)).toHaveAttribute(
    "data-resident-launch",
    "ready",
    { timeout: 30_000 },
  );
}

async function persistentBackgroundOrigin(page: Page): Promise<string> {
  const background = page.locator(PLASMON_BACKGROUND);
  await expect(background).toHaveAttribute("data-resident-launch", "ready", {
    timeout: 30_000,
  });
  const src = await background.getAttribute("src");
  expect(src).not.toBeNull();
  return new URL(src!, page.url()).origin;
}

async function openPlasmon(page: Page): Promise<FrameLocator> {
  const frame = page.locator(PLASMON_FRAME).first();
  if (await frame.count() === 0) {
    const launcher = page.locator('[data-tid="launcher"]');
    if (!await launcher.isVisible()) await page.locator('[data-tid="launcher-open"]').click();
    await expect(launcher).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();
  }
  await expect(frame).toBeVisible({ timeout: 30_000 });
  const app = page.frameLocator(PLASMON_FRAME).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({
    timeout: 30_000,
  });
  return app;
}

function desktopEntry(app: FrameLocator, name: string) {
  return app.locator(".fm-root--desktop [data-fm-node-id]").filter({ hasText: name }).first();
}

async function importPersistenceProbe(
  app: FrameLocator,
  name: string,
  contents: string,
): Promise<string> {
  const desktop = app.locator(".fm-root--desktop").first();
  await expect(desktop).toBeVisible({ timeout: 30_000 });
  await desktop.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(contents, "utf8"),
  });
  const entry = desktopEntry(app, name);
  await expect(entry).toBeVisible({ timeout: 20_000 });
  const nodeId = await entry.getAttribute("data-fm-node-id");
  expect(nodeId).not.toBeNull();
  return nodeId!;
}

async function expectProbeIdentity(
  app: FrameLocator,
  name: string,
  nodeId: string,
): Promise<void> {
  const entry = desktopEntry(app, name);
  await expect(entry).toBeVisible({ timeout: 20_000 });
  await expect(entry).toHaveAttribute("data-fm-node-id", nodeId);
}

async function closePlasmonTile(page: Page): Promise<void> {
  const tile = page.locator(".workspace-tile").filter({ has: page.locator(PLASMON_FRAME) }).first();
  await expect(tile).toBeVisible();
  await tile.getByRole("button", { name: "Close tile" }).click();
  await expect(page.locator(PLASMON_FRAME)).toHaveCount(0);
  await expect(page.locator(PLASMON_BACKGROUND)).toHaveAttribute(
    "data-resident-launch",
    "ready",
  );
}

async function openProbeWindow(app: FrameLocator, name: string): Promise<Locator> {
  await desktopEntry(app, name).dblclick();
  const window = app.getByRole("dialog", { name }).last();
  await expect(window).toBeVisible({ timeout: 20_000 });
  return window;
}

async function windowPlacement(window: Locator): Promise<{ x: number; y: number }> {
  return await window.evaluate((element) => {
    const html = element as HTMLElement;
    return {
      x: Number.parseFloat(html.style.left),
      y: Number.parseFloat(html.style.top),
    };
  });
}

async function moveWindowBy(
  page: Page,
  window: Locator,
  deltaX: number,
  deltaY: number,
): Promise<{ x: number; y: number }> {
  const titlebar = window.locator(".plasmon-window__titlebar");
  const bounds = await titlebar.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds!.x + Math.min(80, bounds!.width / 3);
  const startY = bounds!.y + Math.min(14, bounds!.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 6 });
  await page.mouse.up();

  const moved = await windowPlacement(window);
  await expect.poll(async () => await windowPlacement(window)).toEqual(moved);
  return moved;
}

async function expectWindowPlacement(
  app: FrameLocator,
  name: string,
  expected: { x: number; y: number },
): Promise<void> {
  const window = await openProbeWindow(app, name);
  await expect.poll(async () => await windowPlacement(window)).toEqual(expected);
}

async function expectProbeContents(
  app: FrameLocator,
  name: string,
  contents: string,
): Promise<void> {
  const entry = desktopEntry(app, name);
  await entry.dblclick();
  const editorWindow = app.getByRole("dialog", { name }).last();
  await expect(editorWindow).toBeVisible({ timeout: 20_000 });
  const editor = editorWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
  await expect(editor).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
  await expect(editor.locator(".view-lines")).toContainText(contents.trim(), {
    timeout: 10_000,
  });
}

test("packaged Plasmon preserves a user file and native window placement across tile close, reload, and real browser restart", async ({}, testInfo) => {
  test.setTimeout(180_000);

  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const userDataDir = testInfo.outputPath("persistent-browser-profile");
  const probeName = `Persistence Probe ${Date.now()}.txt`;
  const probeContents = `issue-186-persistence-probe-${Date.now()}\n`;

  let context: BrowserContext | null = await launchPersistentProfile(userDataDir);
  try {
    let page = await firstPage(context);
    await activateKernelPage(page, kernelUrl);
    const initialBackgroundOrigin = await persistentBackgroundOrigin(page);

    let app = await openPlasmon(page);
    const nodeId = await importPersistenceProbe(app, probeName, probeContents);
    const probeWindow = await openProbeWindow(app, probeName);
    const initialPlacement = await windowPlacement(probeWindow);
    const savedPlacement = await moveWindowBy(page, probeWindow, 173, 91);
    expect(savedPlacement).not.toEqual(initialPlacement);

    // Closing only the foreground tile destroys foreground Process/Windowing composition,
    // but the resident filesystem authority remains. Reopening the file must restore the
    // accepted normal rectangle through a fresh WindowManager rather than browser-local state.
    await closePlasmonTile(page);
    expect(await persistentBackgroundOrigin(page)).toBe(initialBackgroundOrigin);
    app = await openPlasmon(page);
    await expectProbeIdentity(app, probeName, nodeId);
    await expectWindowPlacement(app, probeName, savedPlacement);

    // Reload recreates browser frames while retaining the same installed authority/profile.
    await page.reload({ waitUntil: "domcontentloaded" });
    await activateKernelPage(page, kernelUrl);
    expect(await persistentBackgroundOrigin(page)).toBe(initialBackgroundOrigin);
    app = await openPlasmon(page);
    await expectProbeIdentity(app, probeName, nodeId);
    await expectWindowPlacement(app, probeName, savedPlacement);

    // Closing this persistent context closes Chromium. Relaunching it against the same
    // user-data directory is a browser restart; PocketIC and installed apps stay intact.
    await context.close();
    context = await launchPersistentProfile(userDataDir);
    page = await firstPage(context);
    await activateKernelPage(page, kernelUrl);
    expect(await persistentBackgroundOrigin(page)).toBe(initialBackgroundOrigin);
    app = await openPlasmon(page);
    await expectProbeIdentity(app, probeName, nodeId);
    await expectWindowPlacement(app, probeName, savedPlacement);
    await expectProbeContents(app, probeName, probeContents);
  } finally {
    await context?.close();
  }
});
