import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";

async function launchPlasmon(page: import("@playwright/test").Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();
  const selector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
  await expect(page.locator(selector).first()).toBeVisible();
  const plasmon = page.frameLocator(selector).first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { plasmon, kernelUrl };
}

async function closeWindow(window: import("@playwright/test").Locator) {
  await window.getByRole("button", { name: "Close", exact: true }).click();
  await expect(window).toBeHidden();
}

async function openBackgroundMenu(
  plasmon: import("@playwright/test").FrameLocator,
  fileList: import("@playwright/test").Locator,
) {
  const bounds = await fileList.boundingBox();
  if (!bounds) throw new Error("Explorer file list has no browser bounds");
  await fileList.click({
    button: "right",
    position: {
      x: Math.max(80, Math.floor(bounds.width * 0.8)),
      y: Math.max(80, Math.floor(bounds.height * 0.85)),
    },
  });
  return plasmon.getByRole("menu").last();
}

test("packaged scripting executes .cmd through .run and exposes script editor discovery", async ({ page, request }) => {
  const { plasmon, kernelUrl } = await launchPlasmon(page);

  const tsWorker = await request.get(new URL(`/app/${PLASMON_APP_ID}/runtime/monaco/ts.worker.js`, kernelUrl).href);
  expect(tsWorker.ok(), "scripting must package the Monaco TypeScript worker").toBe(true);
  const terminalIcon = await request.get(new URL(`/app/${PLASMON_APP_ID}/static/plasmon/icons/terminal.svg`, kernelUrl).href);
  expect(terminalIcon.ok(), "the packaged Terminal icon asset must be available").toBe(true);

  const terminalTask = plasmon.locator('[data-shell-context-native="native:terminal"]');
  await expect(terminalTask).toBeVisible({ timeout: 15_000 });
  const renderedTerminalIcon = terminalTask.locator('[data-plasmon-owned-icon="system:terminal"]');
  await expect(renderedTerminalIcon).toBeVisible();
  await expect(renderedTerminalIcon.locator("path")).toHaveCount(2);
  await terminalTask.click();
  const terminalWindow = plasmon.getByRole("dialog", { name: "Terminal" }).last();
  await expect(terminalWindow).toBeVisible({ timeout: 15_000 });
  const terminalInput = terminalWindow.getByLabel("Terminal command");
  const terminalSurface = terminalWindow.locator('[data-terminal-engine="xterm"]');
  await expect(terminalSurface).toBeVisible();
  await expect(terminalInput).toBeFocused();

  await terminalInput.pressSequentially('echo "Hello from cmd"');
  await terminalInput.press("Enter");
  await expect(terminalWindow.getByRole("log")).toContainText("Hello from cmd", { timeout: 30_000 });
  await expect(terminalInput).toBeFocused();

  await terminalInput.pressSequentially("pwd");
  await terminalInput.press("Enter");
  await expect(terminalWindow.getByRole("log")).toContainText("/\n", { timeout: 15_000 });
  await expect(terminalInput).toBeFocused();

  await terminalSurface.click();
  await expect(terminalInput).toBeFocused();

  await terminalInput.pressSequentially("exit");
  await terminalInput.press("Enter");
  await expect(terminalWindow).toBeHidden({ timeout: 15_000 });

  await plasmon.getByRole("button", { name: "Search" }).click();
  await plasmon.getByLabel("Search Plasmon").fill("File Explorer");
  const filesResult = plasmon.locator("[data-search-result]", { hasText: "File Explorer" }).first();
  await expect(filesResult).toBeVisible({ timeout: 15_000 });
  await filesResult.click();

  const explorer = plasmon.locator(".explorer-app").last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });
  const fileList = explorer.getByRole("listbox", { name: "Files" });

  const newCmdMenu = await openBackgroundMenu(plasmon, fileList);
  await newCmdMenu.getByRole("menuitem", { name: "New Command Script (.cmd)" }).click();
  const rename = explorer.getByRole("textbox", { name: "Rename New Command Script.cmd" });
  await expect(rename).toBeVisible();
  await rename.fill("Scripting Smoke.cmd");
  await rename.press("Enter");

  const cmdEntry = fileList.locator('[data-fm-node-id]', { hasText: "Scripting Smoke.cmd" }).first();
  await expect(cmdEntry).toBeVisible();

  // Edit must remain explicit and teach the real language identity rather than generic Bash.
  await cmdEntry.click({ button: "right" });
  const firstCmdMenu = plasmon.getByRole("menu").last();
  await expect(firstCmdMenu.getByRole("menuitem", { name: "Run", exact: true })).toBeVisible();
  await expect(firstCmdMenu.getByRole("menuitem", { name: "Transpile to .run", exact: true })).toBeVisible();
  await firstCmdMenu.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const cmdEditor = plasmon.getByRole("dialog", { name: /Scripting Smoke\.cmd/ }).last();
  await expect(cmdEditor).toBeVisible({ timeout: 20_000 });
  await expect(cmdEditor.getByText("Plasmon Command (.cmd)", { exact: true })).toBeVisible();
  const cmdMonaco = cmdEditor.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
  await expect(cmdMonaco).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
  const cmdInputArea = cmdMonaco;
  await cmdInputArea.click();
  await cmdInputArea.press("Control+A");
  await page.keyboard.insertText("ls -");
  await cmdInputArea.press("Control+Space");
  const cmdSuggestions = cmdEditor.locator(".suggest-widget");
  await expect(cmdSuggestions).toBeVisible({ timeout: 15_000 });
  await expect(cmdSuggestions).toContainText("-l");
  await expect(cmdSuggestions).toContainText("-a");
  await expect(cmdSuggestions).toContainText("-la");
  await cmdInputArea.press("Escape");
  await cmdInputArea.press("Control+A");
  await page.keyboard.insertText('echo "Hello from Plasmon"');
  await cmdInputArea.press("Control+S");
  await closeWindow(cmdEditor);

  // Normal file activation must execute .cmd instead of opening it as generic text.
  await cmdEntry.dblclick();
  const cmdTerminal = plasmon.getByRole("dialog", { name: "Terminal" }).last();
  await expect(cmdTerminal.getByRole("log")).toContainText("Running /Scripting Smoke.cmd", { timeout: 20_000 });
  await expect(cmdTerminal.getByRole("log")).toContainText("Hello from Plasmon", { timeout: 30_000 });
  await closeWindow(cmdTerminal);

  await cmdEntry.click({ button: "right" });
  const cmdMenu = plasmon.getByRole("menu").last();
  await expect(cmdMenu.getByRole("menuitem", { name: "Run", exact: true })).toBeVisible();
  await expect(cmdMenu.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
  const transpile = cmdMenu.getByRole("menuitem", { name: "Transpile to .run", exact: true });
  await expect(transpile).toBeVisible();
  await transpile.click();

  const runEntry = fileList.locator('[data-fm-node-id]', { hasText: "Scripting Smoke.run" }).first();
  try {
    await expect(runEntry).toBeVisible({ timeout: 15_000 });
  } catch (cause) {
    const alerts = await explorer.getByRole("alert").allTextContents();
    const visibleNames = await fileList.locator('[data-fm-node-id]').allTextContents();
    throw new Error(
      `Explorer did not project the generated .run. alerts=${JSON.stringify(alerts)} visibleNames=${JSON.stringify(visibleNames)}; ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  // Normal file activation must execute the transpiled .run through the same TypeScript runtime.
  await runEntry.dblclick();
  const runTerminal = plasmon.getByRole("dialog", { name: "Terminal" }).last();
  await expect(runTerminal.getByRole("log")).toContainText("Running /Scripting Smoke.run", { timeout: 20_000 });
  await expect(runTerminal.getByRole("log")).toContainText("Hello from Plasmon", { timeout: 30_000 });
  await closeWindow(runTerminal);

  // Direct New Run Script is independently usable; .run files do not require a .cmd creator.
  const newRunMenu = await openBackgroundMenu(plasmon, fileList);
  await newRunMenu.getByRole("menuitem", { name: "New Run Script (.run)" }).click();
  const renameRun = explorer.getByRole("textbox", { name: "Rename New Run Script.run" });
  await expect(renameRun).toBeVisible();
  await renameRun.fill("Direct Smoke.run");
  await renameRun.press("Enter");
  const directRunEntry = fileList.locator('[data-fm-node-id]', { hasText: "Direct Smoke.run" }).first();
  await expect(directRunEntry).toBeVisible();
  await directRunEntry.dblclick();
  const directRunTerminal = plasmon.getByRole("dialog", { name: "Terminal" }).last();
  await expect(directRunTerminal.getByRole("log")).toContainText("Running /Direct Smoke.run", { timeout: 20_000 });
  await expect(directRunTerminal.getByRole("log")).toContainText("Hello from Plasmon", { timeout: 30_000 });
  await closeWindow(directRunTerminal);

  await runEntry.click({ button: "right" });
  const runMenu = plasmon.getByRole("menu").last();
  await expect(runMenu.getByRole("menuitem", { name: "Run", exact: true })).toBeVisible();
  await runMenu.getByRole("menuitem", { name: "Edit", exact: true }).click();

  const editorWindow = plasmon.getByRole("dialog", { name: "Scripting Smoke.run" }).last();
  await expect(editorWindow).toBeVisible({ timeout: 20_000 });
  await expect(editorWindow.getByText("Plasmon Run (.run)", { exact: true })).toBeVisible();
  const editor = editorWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
  await expect(editor).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
  await expect(editor).toHaveAttribute("data-editor-language", "typescript");

  const inputArea = editor;
  await expect(inputArea).toBeVisible();
  await inputArea.click();
  await inputArea.press("Control+A");
  await page.keyboard.insertText("os.");
  await inputArea.press("Control+Space");
  const suggestions = editorWindow.locator(".suggest-widget");
  await expect(suggestions).toBeVisible({ timeout: 15_000 });
  await expect(suggestions).toContainText("fs");
  await expect(suggestions).toContainText("open");
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
