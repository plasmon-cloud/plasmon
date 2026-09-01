import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { chooseFileManagerBackgroundAction } from "./file-manager-test-helpers.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

async function expectJavaScriptTokenization(window: Locator, message: string): Promise<void> {
  await expect.poll(
    async () => window.locator(".monaco-editor .view-line").evaluateAll((lines) => {
      const classes = new Set<string>();
      for (const line of lines) {
        for (const span of line.querySelectorAll('span[class*="mtk"]')) {
          for (const className of span.classList) if (/^mtk\d+$/.test(className)) classes.add(className);
        }
      }
      return classes.size;
    }),
    { message },
  ).toBeGreaterThan(1);
}

test("Text classifies FileManager rename and Save As language transitions in live Monaco", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector).first()).toBeVisible();
    const app = page.frameLocator(appSelector).first();
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 30_000 });

    // Use only the ordinary Root/Documents filesystem. The test creates every
    // resource it opens and owns its setup independently.
    const rootShortcut = app.getByRole("region", { name: "Desktop" }).locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.click();
    await expect(rootShortcut).toHaveAttribute("aria-selected", "true");
    await app.getByRole("region", { name: "Desktop" }).getByRole("listbox", { name: "Files" }).press("Enter");

    const rootExplorer = app.locator(".explorer-app").last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    const address = rootExplorer.getByRole("textbox", { name: "Address" });
    await expect(address).toHaveValue("/");
    const documentsEntry = rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
    await expect(documentsEntry).toBeVisible({ timeout: 20_000 });
    await documentsEntry.click();
    await expect(documentsEntry).toHaveAttribute("aria-selected", "true");
    await rootExplorer.getByRole("listbox", { name: "Files" }).press("Enter");
    await expect(address).toHaveValue("/Documents", { timeout: 20_000 });

    const documentsExplorer = rootExplorer;
    const documentsWindow = rootExplorer.locator("xpath=ancestor::*[@data-window-id][1]");
    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const generatedName = `Generated JavaScript ${Date.now()}.js`;
    const plainName = `Plain Text Fixture ${Date.now()}.txt`;

    // Create both resources through the production FileManager boundary.
    await chooseFileManagerBackgroundAction(
      documentsExplorer.getByRole("listbox", { name: "Files" }),
      "New Text Document",
    );
    const generatedRename = documentsExplorer.locator('textarea[aria-label^="Rename New Text Document"]').last();
    await expect(generatedRename).toBeVisible();
    await generatedRename.fill(generatedName);
    await generatedRename.press("Enter");
    await expect(documentsExplorer.locator("[data-fm-node-id]", { hasText: generatedName }).first()).toBeVisible({ timeout: 20_000 });

    await chooseFileManagerBackgroundAction(
      documentsExplorer.getByRole("listbox", { name: "Files" }),
      "New Text Document",
    );
    const plainRename = documentsExplorer.locator('textarea[aria-label^="Rename New Text Document"]').last();
    await expect(plainRename).toBeVisible();
    await plainRename.fill(plainName);
    await plainRename.press("Enter");
    const plainEntry = documentsExplorer.locator("[data-fm-node-id]", { hasText: plainName }).first();
    await expect(plainEntry).toBeVisible({ timeout: 20_000 });

    const generatedEntry = documentsExplorer.locator("[data-fm-node-id]", { hasText: generatedName }).first();
    const beforeGeneratedText = await windows.count();
    await generatedEntry.dblclick();
    await expect(windows).toHaveCount(beforeGeneratedText + 1, { timeout: 20_000 });
    const generatedWindow = windows.last();
    const generatedSurface = generatedWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(generatedWindow).toHaveAttribute("aria-label", `${generatedName} - Monaco Editor`);
    await expect(generatedSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(generatedSurface).toHaveAttribute("data-editor-language", "javascript");
    await expect(generatedWindow.getByText("JavaScript", { exact: true })).toBeVisible();

    const generatedInput = generatedWindow.getByRole("textbox", { name: "Text content", exact: true, includeHidden: true }).first();
    await generatedWindow.locator(".monaco-editor .view-line").first().click({ position: { x: 8, y: 10 } });
    await expect(generatedInput).toBeFocused();
    await page.keyboard.insertText("const generated = 42;\nfunction twiceGenerated(value) { return value * 2; }");
    await expect(generatedWindow.getByText("Modified", { exact: true })).toBeVisible();
    await expectJavaScriptTokenization(generatedWindow, "a FileManager text document renamed to .js should render real JavaScript tokenization");

    const filesTask = taskbar.getByRole("button", { name: /^File Explorer;/ }).first();
    await expect(filesTask).toBeVisible();
    await filesTask.click();
    await expect(documentsWindow).toHaveClass(/plasmon-window--active/);
    await plainEntry.dblclick();
    await expect(windows).toHaveCount(beforeGeneratedText + 2, { timeout: 20_000 });
    const textWindow = windows.last();
    const textSurface = textWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(textSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(textSurface).toHaveAttribute("data-editor-language", "plaintext");
    await expect(textWindow.getByText("Plain Text", { exact: true })).toBeVisible();
    const initialModelUri = await textSurface.getAttribute("data-editor-model-uri");
    expect(initialModelUri, "initial Text Monaco model should expose concrete model identity").toBeTruthy();

    const browserInput = textWindow.getByRole("textbox", { name: "Text content", exact: true, includeHidden: true }).first();
    await textWindow.locator(".monaco-editor .view-line").first().click({ position: { x: 8, y: 10 } });
    await expect(browserInput).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("const answer = 42;\nfunction twice(value) { return value * 2; }");
    await expect(textWindow.getByText("Modified", { exact: true })).toBeVisible();

    const scriptName = `Saved JavaScript ${Date.now()}.js`;
    await textWindow.getByRole("textbox", { name: "Save As file name" }).fill(scriptName);
    await textWindow.getByRole("button", { name: "Create copy", exact: true }).click();
    await expect(textWindow).toHaveAttribute("aria-label", `${scriptName} - Monaco Editor`);
    await expect(textWindow.getByText("JavaScript", { exact: true })).toBeVisible();
    await expect(textSurface).toHaveAttribute("data-editor-ready", "true");
    await expect(textSurface).toHaveAttribute("data-editor-language", "javascript");
    await expect(textSurface).toHaveAttribute("data-editor-model-uri", initialModelUri!);
    await expectJavaScriptTokenization(textWindow, "JavaScript source should render multiple Monaco syntax token classes");

    await textWindow.locator(".monaco-editor .view-line").last().click({ position: { x: 160, y: 10 } });
    await page.keyboard.insertText("\nconst persisted = twice(answer);");
    await expect(textWindow.getByText("Modified", { exact: true })).toBeVisible();
    await textWindow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(textWindow.getByText("Saved", { exact: true })).toBeVisible();

    await filesTask.click();
    await expect(documentsWindow).toHaveClass(/plasmon-window--active/);
    const script = documentsExplorer.locator("[data-fm-node-id]", { hasText: scriptName }).first();
    await expect(script).toBeVisible({ timeout: 20_000 });
    const beforeReopen = await windows.count();
    await script.dblclick();
    await expect(windows).toHaveCount(beforeReopen + 1, { timeout: 20_000 });
    const reopenedWindow = windows.last();
    const reopenedSurface = reopenedWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(reopenedSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(reopenedSurface).toHaveAttribute("data-editor-language", "javascript");
    await expect(reopenedWindow.getByText("JavaScript", { exact: true })).toBeVisible();
    await expect(reopenedWindow.locator(".monaco-editor .view-lines")).toContainText("const persisted = twice(answer);");
    await expectJavaScriptTokenization(reopenedWindow, "an already-named .js resource should reopen with real JavaScript tokenization");
    const reopenedModelUri = await reopenedSurface.getAttribute("data-editor-model-uri");
    expect(reopenedModelUri, "reopened JavaScript should expose concrete Monaco model identity").toBeTruthy();

    const roundTripName = `Round Trip Text ${Date.now()}.txt`;
    await reopenedWindow.getByRole("textbox", { name: "Save As file name" }).fill(roundTripName);
    await reopenedWindow.getByRole("button", { name: "Create copy", exact: true }).click();
    await expect(reopenedWindow).toHaveAttribute("aria-label", `${roundTripName} - Monaco Editor`);
    await expect(reopenedWindow.getByText("Plain Text", { exact: true })).toBeVisible();
    await expect(reopenedSurface).toHaveAttribute("data-editor-language", "plaintext");
    await expect(reopenedSurface).toHaveAttribute("data-editor-model-uri", reopenedModelUri!);

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
