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

test("packaged experiment executes .cmd through .run and exposes .run TypeScript completion", async ({ page, request }) => {
  const { plasmon, kernelUrl } = await launchPlasmon(page);

  const tsWorker = await request.get(new URL(`/app/${PLASMON_APP_ID}/runtime/monaco/ts.worker.js`, kernelUrl).href);
  expect(tsWorker.ok(), "the experiment must package the Monaco TypeScript worker").toBe(true);

  const terminalTask = plasmon.locator('[data-shell-context-native="native:terminal"]');
  await expect(terminalTask).toBeVisible({ timeout: 15_000 });
  await terminalTask.click();
  const terminalWindow = plasmon.getByRole("dialog", { name: "Terminal" }).last();
  await expect(terminalWindow).toBeVisible({ timeout: 15_000 });
  const terminalInput = terminalWindow.getByLabel("Terminal command");
  await terminalInput.fill('echo "Hello from cmd"');
  await terminalInput.press("Enter");
  await expect(
    terminalWindow.locator('[data-terminal-tone="stdout"]', { hasText: "Hello from cmd" }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await terminalInput.fill("pwd");
  await terminalInput.press("Enter");
  await expect(
    terminalWindow.locator('[data-terminal-tone="stdout"]', { hasText: /^\/\n?$/ }).first(),
  ).toBeVisible({ timeout: 15_000 });

  await plasmon.getByRole("button", { name: "Search" }).click();
  await plasmon.getByLabel("Search Plasmon").fill("Files");
  const filesResult = plasmon.locator("[data-search-result]", { hasText: "Files" }).first();
  await expect(filesResult).toBeVisible({ timeout: 15_000 });
  await filesResult.click();

  const explorer = plasmon.locator(".explorer-app").last();
  await expect(explorer).toBeVisible({ timeout: 15_000 });
  const fileList = explorer.getByRole("listbox", { name: "Files" });
  const bounds = await fileList.boundingBox();
  if (!bounds) throw new Error("Explorer file list has no browser bounds");
  await fileList.click({
    button: "right",
    position: {
      x: Math.max(80, Math.floor(bounds.width * 0.8)),
      y: Math.max(80, Math.floor(bounds.height * 0.85)),
    },
  });
  await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();
  const rename = explorer.getByRole("textbox", { name: "Rename New Text Document.txt" });
  await expect(rename).toBeVisible();
  await rename.fill("Experiment Smoke.cmd");
  await rename.press("Enter");

  const cmdEntry = fileList.locator('[data-fm-node-id]', { hasText: "Experiment Smoke.cmd" }).first();
  await expect(cmdEntry).toBeVisible();
  await cmdEntry.click({ button: "right" });
  const transpile = plasmon.getByRole("menu").last().getByRole("menuitem", { name: "Transpile to .run" });
  await expect(transpile).toBeVisible();
  await transpile.click();

  const runEntry = fileList.locator('[data-fm-node-id]', { hasText: "Experiment Smoke.run" }).first();
  try {
    await expect(runEntry).toBeVisible({ timeout: 15_000 });
  } catch (cause) {
    const alerts = await explorer.getByRole("alert").allTextContents();
    const visibleNames = await fileList.locator('[data-fm-node-id]').allTextContents();
    throw new Error(
      `Explorer did not project the generated .run. alerts=${JSON.stringify(alerts)} visibleNames=${JSON.stringify(visibleNames)}; ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  await runEntry.dblclick();

  const editorWindow = plasmon.getByRole("dialog", { name: "Experiment Smoke.run" }).last();
  await expect(editorWindow).toBeVisible({ timeout: 20_000 });
  const editor = editorWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
  await expect(editor).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
  await expect(editor).toHaveAttribute("data-editor-language", "typescript");

  const inputArea = editor.locator("textarea.inputarea").first();
  await expect(inputArea).toBeAttached();
  await inputArea.click();
  await inputArea.press("Control+A");
  await inputArea.pressSequentially("os.");
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
