import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

type BrowserPageError = {
  name: string;
  message: string;
  stack?: string;
};

test("packaged Text and Markdown edit save and reopen through real Monaco", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: BrowserPageError[] = [];
  let disposalBoundary = false;

  page.on("pageerror", (error) => {
    const captured = { name: error.name, message: error.message, stack: error.stack };
    if (disposalBoundary && error.message === "Canceled") {
      pageErrors.push(captured);
      return;
    }
    pageErrors.push(captured);
  });

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
  const initialWindowCount = await nativeWindows.count();
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();
  await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

  const explorer = nativeWindows.last();
  const explorerWindowId = await explorer.getAttribute("data-window-id");
  if (!explorerWindowId) throw new Error("Explorer window has no stable data-window-id");
  const explorerWindow = app.locator(`.plasmon-window-layer [data-window-id="${explorerWindowId}"]`);
  await expect(explorerWindow.getByLabel("File Explorer", { exact: true })).toBeVisible();

  const expectNoPageErrors = (label: string): void => {
    expect(pageErrors, label).toEqual([]);
  };

  const createDocument = async (
    createButton: "New Text Document" | "New Markdown Document",
    generatedName: "New Text Document" | "New Markdown Document",
    fileName: string,
  ) => {
    await explorerWindow.getByRole("button", { name: createButton, exact: true }).click();
    const rename = explorerWindow.getByRole("textbox", { name: new RegExp(`^Rename ${generatedName}`) }).first();
    await expect(rename).toBeVisible();
    await rename.fill(fileName);
    await rename.press("Enter");
    const entry = explorerWindow.locator("[data-fm-node-id]", { hasText: fileName }).first();
    await expect(entry).toBeVisible();
    return entry;
  };

  const openDocument = async (entry: ReturnType<typeof explorerWindow.locator>, appLabel: string) => {
    const before = await nativeWindows.count();
    await entry.dblclick();
    await expect(nativeWindows).toHaveCount(before + 1, { timeout: 20_000 });
    const openedWindow = nativeWindows.last();
    await expect(openedWindow.getByLabel(appLabel, { exact: true })).toBeVisible();
    return { before, editorWindow: openedWindow };
  };

  const waitForUsableMonaco = async (openedWindow: ReturnType<typeof nativeWindows.last>, label: string) => {
    const surface = openedWindow.locator('[data-editor-engine="monaco"]').first();
    await expect(surface).toBeVisible();
    try {
      await expect(surface, `${label} should reach packaged Monaco readiness`).toHaveAttribute(
        "data-editor-ready",
        "true",
        { timeout: 30_000 },
      );
    } catch (cause: unknown) {
      const alert = openedWindow.getByRole("alert").filter({ hasText: "Monaco failed to load" }).first();
      const details = await alert.textContent({ timeout: 500 }).catch(() => null);
      throw new Error(
        `${label} packaged Monaco did not become usable${details ? `: ${details}` : `: ${cause instanceof Error ? cause.message : String(cause)}`}`,
      );
    }
    return surface;
  };

  const closeDocument = async (
    before: number,
    openedWindow: ReturnType<typeof nativeWindows.last>,
    label: string,
  ) => {
    expectNoPageErrors(`${label} must begin without browser errors`);
    disposalBoundary = true;
    try {
      await openedWindow.getByRole("button", { name: "Close", exact: true }).click();
      await expect(nativeWindows).toHaveCount(before, { timeout: 10_000 });
      await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    } finally {
      disposalBoundary = false;
    }

    const disposalErrors = pageErrors.splice(0);
    expect(disposalErrors.length, `${label} may emit at most one proven Monaco disposal cancellation`).toBeLessThanOrEqual(1);
    if (disposalErrors.length === 1) {
      const [error] = disposalErrors;
      expect(error).toMatchObject({ name: "Canceled", message: "Canceled" });
      const stack = error?.stack ?? "";
      const cancelIndex = stack.indexOf(".cancel (");
      const disposeIndex = stack.indexOf(".dispose (");
      expect(cancelIndex, `${label} cancellation must originate from cancel()`).toBeGreaterThanOrEqual(0);
      expect(disposeIndex, `${label} cancellation must flow into dispose()`).toBeGreaterThan(cancelIndex);
    }
  };

  const exercisePackagedEditor = async (options: {
    createButton: "New Text Document" | "New Markdown Document";
    generatedName: "New Text Document" | "New Markdown Document";
    fileName: string;
    appLabel: "Text editor" | "Markdown editor";
    sourceLabel: "Text content" | "Markdown source";
    persistedText: string;
  }) => {
    const entry = await createDocument(options.createButton, options.generatedName, options.fileName);
    const opened = await openDocument(entry, options.appLabel);
    const surface = await waitForUsableMonaco(opened.editorWindow, options.appLabel);
    await expect(surface).toHaveAttribute("aria-label", options.sourceLabel);

    const browserInput = opened.editorWindow.getByRole("textbox", {
      name: options.sourceLabel,
      exact: true,
      includeHidden: true,
    }).first();
    const firstLine = opened.editorWindow.locator(".monaco-editor .view-line").first();
    await expect(firstLine).toBeVisible();
    await firstLine.click({ position: { x: 8, y: 10 } });
    await expect(browserInput).toBeFocused();
    await page.keyboard.insertText(options.persistedText);
    await expect(opened.editorWindow.getByText("Modified", { exact: true })).toBeVisible();
    await expect(firstLine).toHaveText(options.persistedText);
    await expect(surface).toHaveAttribute("data-editor-ready", "true");
    expectNoPageErrors(`${options.appLabel} edit must not emit browser errors`);

    const save = opened.editorWindow.getByRole("button", { name: "Save", exact: true });
    await save.click();
    await expect(opened.editorWindow.getByText("Saved", { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    expectNoPageErrors(`${options.appLabel} save must not emit browser errors`);
    await closeDocument(opened.before, opened.editorWindow, `${options.appLabel} saved close`);

    const reopened = await openDocument(entry, options.appLabel);
    await waitForUsableMonaco(reopened.editorWindow, `${options.appLabel} after reopen`);
    await expect(reopened.editorWindow.locator(".monaco-editor .view-line").first()).toHaveText(options.persistedText);
    expectNoPageErrors(`${options.appLabel} reopen must preserve exact content without browser errors`);
    await closeDocument(reopened.before, reopened.editorWindow, `${options.appLabel} reopened close`);
  };

  await exercisePackagedEditor({
    createButton: "New Text Document",
    generatedName: "New Text Document",
    fileName: "Packaged Monaco Text.txt",
    appLabel: "Text editor",
    sourceLabel: "Text content",
    persistedText: "packaged text persisted",
  });
  await exercisePackagedEditor({
    createButton: "New Markdown Document",
    generatedName: "New Markdown Document",
    fileName: "Packaged Monaco Markdown.md",
    appLabel: "Markdown editor",
    sourceLabel: "Markdown source",
    persistedText: "packaged markdown persisted",
  });

  expectNoPageErrors("packaged Monaco acceptance must finish without unexplained browser errors");
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
