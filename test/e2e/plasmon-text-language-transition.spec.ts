import { expect, test, type Locator, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";

async function redirectToFirstDemo(route: Route): Promise<void> {
  const requestUrl = new URL(route.request().url());
  const appRoot = `/app/${APP_ID}/`;
  const isMainDocument = route.request().resourceType() === "document"
    && (requestUrl.pathname === appRoot || requestUrl.pathname === `${appRoot}index.html`);
  if (!isMainDocument || requestUrl.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE) {
    await route.continue();
    return;
  }
  requestUrl.searchParams.set(FIXTURE_PARAM, FIXTURE_VALUE);
  await route.fulfill({
    status: 307,
    headers: { location: requestUrl.href, "cache-control": "no-store" },
  });
}

async function expectJavaScriptTokenization(window: Locator, message: string): Promise<void> {
  await expect.poll(
    async () => window.locator(".monaco-editor .view-line").evaluateAll((lines) => {
      const classes = new Set<string>();
      for (const line of lines) {
        for (const span of line.querySelectorAll('span[class*="mtk"]')) {
          for (const className of span.classList) {
            if (/^mtk\d+$/.test(className)) classes.add(className);
          }
        }
      }
      return classes.size;
    }),
    { message },
  ).toBeGreaterThan(1);
}

test("#415 Text classifies FileManager rename and Save As language transitions in live Monaco", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    const fixtureRoute = `**/app/${APP_ID}/**`;
    await page.route(fixtureRoute, redirectToFirstDemo);
    const fixtureNavigation = page.waitForEvent("framenavigated", (candidate) => {
      try {
        const url = new URL(candidate.url());
        return (url.pathname === `/app/${APP_ID}/` || url.pathname === `/app/${APP_ID}/index.html`)
          && url.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE;
      } catch {
        return false;
      }
    });

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();
    await fixtureNavigation;
    await page.unroute(fixtureRoute, redirectToFirstDemo);

    const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appSelector)).toBeVisible();
    const app = page.frameLocator(appSelector);
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 30_000 });

    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    await rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();

    const documentsExplorer = app.getByRole("dialog", { name: "Documents" }).last();
    await expect(documentsExplorer).toBeVisible({ timeout: 20_000 });
    const windows = app.locator(".plasmon-window-layer [data-window-id]");

    // Reproduce the screenshot boundary: FileManager creates a blank text document,
    // immediately renames the same NodeId to .js, and Text must open real JavaScript.
    const generatedName = `Issue 415 Generated ${Date.now()}.js`;
    await documentsExplorer.getByRole("button", { name: "New Text Document", exact: true }).click();
    const generatedRename = documentsExplorer.locator('textarea[aria-label^="Rename New Text Document"]').last();
    await expect(generatedRename).toBeVisible();
    await generatedRename.fill(generatedName);
    await generatedRename.press("Enter");

    const generatedEntry = documentsExplorer.locator("[data-fm-node-id]", { hasText: generatedName }).first();
    await expect(generatedEntry).toBeVisible({ timeout: 20_000 });
    const beforeGeneratedText = await windows.count();
    await generatedEntry.dblclick();
    await expect(windows).toHaveCount(beforeGeneratedText + 1, { timeout: 20_000 });

    const generatedWindow = windows.last();
    const generatedSurface = generatedWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(generatedWindow).toHaveAttribute("aria-label", `${generatedName} - Monaco Editor`);
    await expect(generatedSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(generatedSurface).toHaveAttribute("data-editor-language", "javascript");
    await expect(generatedWindow.getByText("JavaScript", { exact: true })).toBeVisible();

    const generatedInput = generatedWindow.getByRole("textbox", {
      name: "Text content",
      exact: true,
      includeHidden: true,
    }).first();
    const generatedFirstLine = generatedWindow.locator(".monaco-editor .view-line").first();
    await generatedFirstLine.click({ position: { x: 8, y: 10 } });
    await expect(generatedInput).toBeFocused();
    await page.keyboard.insertText("const generated = 42;\nfunction twiceGenerated(value) { return value * 2; }");
    await expect(generatedWindow.getByText("Modified", { exact: true })).toBeVisible();
    await expectJavaScriptTokenization(
      generatedWindow,
      "a FileManager text document renamed to .js should render real JavaScript tokenization",
    );

    const filesTask = taskbar.getByRole("button", { name: /^Files;/ }).first();
    await filesTask.click();
    await expect(documentsExplorer).toHaveClass(/plasmon-window--active/);

    const notes = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first();
    await expect(notes).toBeVisible();

    const beforeText = await windows.count();
    await notes.dblclick();
    await expect(windows).toHaveCount(beforeText + 1, { timeout: 20_000 });
    const textWindow = windows.last();
    const textSurface = textWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(textSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(textSurface).toHaveAttribute("data-editor-language", "plaintext");
    await expect(textWindow.getByText("Plain Text", { exact: true })).toBeVisible();
    const initialModelUri = await textSurface.getAttribute("data-editor-model-uri");
    expect(initialModelUri, "initial Text Monaco model should expose concrete model identity").toBeTruthy();

    const browserInput = textWindow.getByRole("textbox", {
      name: "Text content",
      exact: true,
      includeHidden: true,
    }).first();
    const firstLine = textWindow.locator(".monaco-editor .view-line").first();
    await firstLine.click({ position: { x: 8, y: 10 } });
    await expect(browserInput).toBeFocused();
    const javascriptSource = "const answer = 42;\nfunction twice(value) { return value * 2; }";
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(javascriptSource);
    await expect(textWindow.getByText("Modified", { exact: true })).toBeVisible();

    const scriptName = `Issue 415 ${Date.now()}.js`;
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
    await expect(documentsExplorer).toHaveClass(/plasmon-window--active/);
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
    await expectJavaScriptTokenization(
      reopenedWindow,
      "an already-named .js resource should reopen with real JavaScript tokenization",
    );
    const reopenedModelUri = await reopenedSurface.getAttribute("data-editor-model-uri");
    expect(reopenedModelUri, "reopened JavaScript should expose concrete Monaco model identity").toBeTruthy();

    const roundTripName = `Issue 415 ${Date.now()}.txt`;
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
