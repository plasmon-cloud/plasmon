import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const CONFIG_DIRECTORY = "/System/Program Files/MonacoEditor";
const CONFIG_FILE = "config.json";

async function launchPlasmon(
  page: Page,
  kernelUrl: string,
  developerIdentitySeed: number,
  developerIdentityPrincipal: string,
): Promise<FrameLocator> {
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    developerIdentitySeed,
  );
  expect(principal).toBe(developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const selector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(selector).first()).toBeAttached();
  const app = page.frameLocator(selector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 15_000 });
  return app;
}

async function waitForMonaco(window: Locator): Promise<Locator> {
  const surface = window.locator('[data-editor-engine="monaco"][aria-label="Text content"]').first();
  await expect(surface).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
  return surface;
}

async function createDesktopTextDocument(app: FrameLocator, name: string): Promise<Locator> {
  const desktopFiles = app.getByRole("listbox", { name: "Files" }).first();
  await expect(desktopFiles).toBeVisible();
  const bounds = await desktopFiles.boundingBox();
  if (!bounds) throw new Error("Desktop FileManager has no browser bounds");
  await desktopFiles.click({
    button: "right",
    position: {
      x: Math.max(120, Math.floor(bounds.width * 0.55)),
      y: Math.max(120, Math.floor(bounds.height * 0.55)),
    },
  });
  await app.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
  const rename = app.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await expect(rename).toBeVisible();
  await rename.fill(name);
  await rename.press("Enter");
  const entry = desktopFiles.locator("[data-fm-node-id]", { hasText: name }).first();
  await expect(entry).toBeVisible();
  return entry;
}

async function openFileManagerAtConfig(app: FrameLocator, nativeWindows: Locator): Promise<Locator> {
  const before = await nativeWindows.count();
  await app.getByRole("button", { name: "Search" }).click();
  const search = app.getByRole("region", { name: "Search" });
  await expect(search).toBeVisible();
  await app.getByLabel("Search Plasmon").fill("File");
  const result = app.locator("[data-search-result]", { hasText: "Plasmon application" }).first();
  await expect(result).toBeVisible({ timeout: 15_000 });
  await result.click();
  await expect(nativeWindows).toHaveCount(before + 1, { timeout: 15_000 });

  const fileManagerWindow = nativeWindows.last();
  const address = fileManagerWindow.getByLabel("Address");
  const files = fileManagerWindow.getByRole("listbox", { name: "Files" });
  await expect(address).toBeVisible();
  await expect(files).toBeVisible();

  const systemEntry = files.locator("[data-fm-node-id]", { hasText: "System" }).first();
  await expect(systemEntry).toBeVisible({ timeout: 15_000 });
  await systemEntry.dblclick();
  await expect(address).toHaveValue("/System", { timeout: 15_000 });

  const programFilesEntry = files.locator("[data-fm-node-id]", { hasText: "Program Files" }).first();
  await expect(programFilesEntry).toBeVisible({ timeout: 15_000 });
  await programFilesEntry.dblclick();
  await expect(address).toHaveValue("/System/Program Files", { timeout: 15_000 });

  const monacoEntry = files.locator("[data-fm-node-id]", { hasText: "MonacoEditor" }).first();
  await expect(monacoEntry).toBeVisible({ timeout: 15_000 });
  await monacoEntry.dblclick();
  await expect(address).toHaveValue(CONFIG_DIRECTORY, { timeout: 15_000 });

  const configEntry = files.locator("[data-fm-node-id]", { hasText: CONFIG_FILE }).first();
  await expect(configEntry).toBeVisible({ timeout: 15_000 });
  return configEntry;
}

async function replaceTextEditorContents(page: Page, editorWindow: Locator, text: string): Promise<void> {
  const input = editorWindow.getByRole("textbox", {
    name: "Text content",
    exact: true,
    includeHidden: true,
  }).first();
  const firstLine = editorWindow.locator(".monaco-editor .view-line").first();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  await page.evaluate(async (value) => navigator.clipboard.writeText(value), text);
  await expect(firstLine).toBeVisible();
  await firstLine.click({ position: { x: 8, y: 10 } });
  await expect(input).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Control+V");
  await expect(editorWindow.getByText("Modified", { exact: true })).toBeVisible();
}

async function expectMinimap(window: Locator, visible: boolean): Promise<void> {
  const minimap = window.locator(".monaco-editor .minimap").first();
  if (visible) await expect(minimap).toBeVisible();
  else await expect(minimap).not.toBeVisible();
}

test("packaged Monaco runtime config updates an open editor in place through Program Files", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  try {
    const app = await launchPlasmon(
      page,
      kernelUrl,
      runtime.developerIdentitySeed,
      runtime.developerIdentityPrincipal,
    );
    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const documentEntry = await createDesktopTextDocument(app, "Runtime Config Probe.txt");

    const beforeDocument = await nativeWindows.count();
    await documentEntry.dblclick();
    await expect(nativeWindows).toHaveCount(beforeDocument + 1, { timeout: 15_000 });
    const documentWindow = nativeWindows.last();
    const documentSurface = await waitForMonaco(documentWindow);
    await expectMinimap(documentWindow, true);

    await replaceTextEditorContents(page, documentWindow, "unsaved runtime config probe");
    const documentInput = documentWindow.getByRole("textbox", {
      name: "Text content",
      exact: true,
      includeHidden: true,
    }).first();
    await expect(documentInput).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.up("Shift");
    await expect(documentWindow.getByText(/3 selected$/)).toBeVisible();

    const modelUri = await documentSurface.getAttribute("data-editor-model-uri");
    expect(modelUri).toBeTruthy();

    const configEntry = await openFileManagerAtConfig(app, nativeWindows);
    const beforeConfig = await nativeWindows.count();
    await configEntry.dblclick();
    await expect(nativeWindows).toHaveCount(beforeConfig + 1, { timeout: 15_000 });
    const configWindow = nativeWindows.last();
    await waitForMonaco(configWindow);

    const disabledConfig = `${JSON.stringify({
      schema: "plasmon.monaco-runtime-config-v1",
      editor: { minimap: { enabled: false } },
    }, null, 2)}\n`;
    await replaceTextEditorContents(page, configWindow, disabledConfig);
    await configWindow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(configWindow.getByText("Saved", { exact: true })).toBeVisible();

    await expectMinimap(documentWindow, false);
    await expect(documentSurface).toHaveAttribute("data-editor-model-uri", modelUri!);
    await expect(documentWindow.getByText("Modified", { exact: true })).toBeVisible();
    await expect(documentWindow.locator(".monaco-editor .view-line").first()).toHaveText("unsaved runtime config probe");
    await expect(documentWindow.getByText(/3 selected$/)).toBeVisible();

    const enabledConfig = `${JSON.stringify({
      schema: "plasmon.monaco-runtime-config-v1",
      editor: { minimap: { enabled: true } },
    }, null, 2)}\n`;
    await replaceTextEditorContents(page, configWindow, enabledConfig);
    await configWindow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(configWindow.getByText("Saved", { exact: true })).toBeVisible();

    await expectMinimap(documentWindow, true);
    await expect(documentSurface).toHaveAttribute("data-editor-model-uri", modelUri!);
    await expect(documentWindow.getByText("Modified", { exact: true })).toBeVisible();
    await expect(documentWindow.locator(".monaco-editor .view-line").first()).toHaveText("unsaved runtime config probe");
    await expect(documentWindow.getByText(/3 selected$/)).toBeVisible();

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
