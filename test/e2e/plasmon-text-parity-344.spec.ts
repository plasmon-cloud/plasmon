import { expect, test, type Route } from "@playwright/test";
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

test("#344 — packaged Text exposes accepted Monaco parity affordances", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

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

  const appSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appSelector)).toBeVisible();
  const app = page.frameLocator(appSelector);
  const taskbar = app.getByRole("navigation", { name: "Taskbar" });
  await expect(taskbar).toBeVisible({ timeout: 30_000 });
  await page.unroute(fixtureRoute, redirectToFirstDemo);

  // Reach Text through the real filesystem and association path used by the
  // existing packaged Monaco acceptance; this test owns parity presentation,
  // not a second Monaco worker/readiness authority.
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();
  const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
  await rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first().dblclick();

  const documentsExplorer = app.getByRole("dialog", { name: "Documents" }).last();
  await expect(documentsExplorer).toBeVisible({ timeout: 20_000 });
  const notes = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first();
  await expect(notes).toBeVisible();

  // #344 adds no scenario-specific warning/error allowance. BrowserHealth's
  // release-scoped exact #305 Chromium diagnostic rule is the only quarantine.
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  try {
    const windows = app.locator(".plasmon-window-layer [data-window-id]");
    const beforeNotes = await windows.count();
    await notes.dblclick();
    await expect(windows).toHaveCount(beforeNotes + 1, { timeout: 20_000 });
    const notesWindow = windows.last();
    await expect(notesWindow).toHaveAttribute("aria-label", "First Demo Notes.txt - Monaco Editor");

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
    await expect(documentsExplorer).toHaveClass(/plasmon-window--active/);

    // Import a representative JavaScript resource through normal Explorer UI so
    // the packaged Text window proves shared resource classification drives the
    // visible Monaco language status instead of a Text-only extension table.
    const scriptName = `Packaged Text Parity ${Date.now()}.js`;
    const chooserPromise = page.waitForEvent("filechooser");
    await documentsExplorer.getByRole("button", { name: "Import Files…" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: scriptName,
      mimeType: "application/javascript",
      buffer: Buffer.from("const first = 1;\nconst second = 2;\n"),
    });
    const script = documentsExplorer.locator("[data-fm-node-id]", { hasText: scriptName }).first();
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
