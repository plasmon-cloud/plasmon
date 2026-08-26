import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("[demo profile] #344 — packaged Text exposes accepted Monaco parity affordances", { tag: ["@demo-profile", "@issue-344"] }, async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appSelector)).toBeVisible();
  const app = page.frameLocator(appSelector);
  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  await expect(taskbar).toBeVisible({ timeout: 30_000 });

  // Reach Text through the real filesystem and association path used by the
  // existing packaged Monaco acceptance; this test owns parity presentation,
  // not a second Monaco worker/readiness authority.
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();
  const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
  const notes = app.locator("[data-fm-node-id]", { hasText: "Demo Notes.txt" }).first();
  await expect(notes).toBeVisible({ timeout: 20_000 });

  // #344 adds no scenario-specific warning/error allowance. BrowserHealth's
  // release-scoped exact #305 Chromium diagnostic rule is the only quarantine.
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [{
      kind: "console.error",
      messageIncludes: "[Gemma] model load failed Error: The browser did not expose a WebGPU adapter.",
      urlPathPrefix: "/app/gemma/model-worker.js",
      reason: "Full demo deployment includes Gemma; hosted Chromium has no WebGPU adapter for its optional model",
    }],
  });
  try {
    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const beforeNotes = await windows.count();
    await notes.dblclick();
    await expect(windows).toHaveCount(beforeNotes + 1, { timeout: 20_000 });
    const notesWindow = windows.last();
    await expect(notesWindow).toHaveAttribute("aria-label", "Demo Notes.txt - Monaco Editor");

    const notesSurface = notesWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(notesSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(notesWindow.getByText("Plain Text", { exact: true })).toBeVisible();
    await expect(notesWindow.getByText("UTF-8", { exact: true })).toBeVisible();
    await expect(notesWindow.getByText(/^Ln 1, Col 1/)).toBeVisible();

    const minimapToggle = notesWindow.getByRole("button", { name: "Minimap", exact: true });
    const minimap = notesWindow.locator(".monaco-editor .minimap").first();
    await expect(minimapToggle).toHaveAttribute("aria-pressed", "true");
    await expect(minimap).toBeVisible();
    await minimapToggle.click();
    await expect(minimapToggle).toHaveAttribute("aria-pressed", "false");
    await expect(minimap).not.toBeVisible();
    await minimapToggle.click();
    await expect(minimapToggle).toHaveAttribute("aria-pressed", "true");
    await expect(minimap).toBeVisible();

    const find = notesWindow.getByRole("button", { name: "Find", exact: true });
    const replace = notesWindow.getByRole("button", { name: "Replace", exact: true });
    const goToLine = notesWindow.getByRole("button", { name: "Go to line", exact: true });
    await expect(find).toBeEnabled();
    await expect(replace).toBeEnabled();
    await expect(goToLine).toBeEnabled();

    await find.click();
    await expect(notesWindow.locator(".monaco-editor .find-widget")).toBeVisible();
    await page.keyboard.press("Escape");

    await replace.click();
    await expect(notesWindow.locator(".monaco-editor .find-widget")).toBeVisible();
    await expect(notesWindow.locator(".monaco-editor .find-widget .replace-part")).toBeVisible();
    await page.keyboard.press("Escape");

    await goToLine.click();
    await expect(notesWindow.locator(".monaco-editor .quick-input-widget")).toBeVisible();
    await page.keyboard.press("Escape");

    // Return focus to the real running Explorer through the taskbar before
    // using its browser file-import control; Monaco currently owns the active
    // window and otherwise legitimately intercepts pointer input.
    const filesTask = taskbar.getByRole("button", { name: /^Files;/ }).first();
    await expect(filesTask).toBeVisible();
    await filesTask.click();
    await expect(rootExplorer).toHaveClass(/plasmon-window--active/);

    // Import a representative JavaScript resource through normal Explorer UI so
    // the packaged Text window proves shared resource classification drives the
    // visible Monaco language status instead of a Text-only extension table.
    const scriptName = `Packaged Text Parity ${Date.now()}.js`;
    const chooserPromise = page.waitForEvent("filechooser");
    await rootExplorer.getByRole("button", { name: "Import Files…" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: scriptName,
      mimeType: "application/javascript",
      buffer: Buffer.from("const first = 1;\nconst second = 2;\n"),
    });
    const script = rootExplorer.locator("[data-fm-node-id]", { hasText: scriptName }).first();
    await expect(script).toBeVisible({ timeout: 20_000 });

    const beforeScript = await windows.count();
    await script.dblclick();
    await expect(windows).toHaveCount(beforeScript + 1, { timeout: 20_000 });
    const scriptWindow = windows.last();
    await expect(scriptWindow).toHaveAttribute("aria-label", `${scriptName} - Monaco Editor`);
    const scriptSurface = scriptWindow.locator('[data-editor-engine="monaco"][aria-label="Text content"]');
    await expect(scriptSurface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(scriptWindow.getByText("JavaScript", { exact: true })).toBeVisible();
    await expect(scriptWindow.getByText("UTF-8", { exact: true })).toBeVisible();

    const secondLine = scriptWindow.locator(".monaco-editor .view-line").nth(1);
    await expect(secondLine).toBeVisible();
    await secondLine.click({ position: { x: 12, y: 10 } });
    await expect(scriptWindow.getByText(/^Ln 2, Col /)).toBeVisible();
    await expect(scriptWindow.getByRole("button", { name: "Minimap", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(scriptWindow.locator(".monaco-editor .minimap").first()).toBeVisible();

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
