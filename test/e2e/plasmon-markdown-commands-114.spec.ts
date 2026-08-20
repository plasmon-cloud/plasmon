import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";

test(
  "#114 packaged Markdown exposes formatter and Monaco commands",
  { tag: ["@issue-114"] },
  async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  const fixtureRoute = `**/app/${APP_ID}/**`;
  const redirectInitialPlasmonDocument = async (route: Route) => {
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
  };
  await page.route(fixtureRoute, redirectInitialPlasmonDocument);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${APP_ID}-${TILE_ID}"]`).click();

  const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
  await expect(page.locator(appFrameSelector).first()).toBeAttached();
  const app = page.frameLocator(appFrameSelector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);

  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible();
  await rootShortcut.dblclick();
  const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
  await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
  const documents = rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
  await documents.dblclick();

  const documentsExplorer = app.getByRole("dialog", { name: "Documents" }).last();
  await expect(documentsExplorer).toBeVisible({ timeout: 20_000 });
  const guide = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Guide.md" }).first();
  await expect(guide).toBeVisible();
  await guide.dblclick();

  const editorWindow = app.getByRole("dialog", { name: "First Demo Guide.md - Monaco Editor" }).last();
  await expect(editorWindow).toBeVisible({ timeout: 20_000 });
  await expect(editorWindow.getByLabel("Markdown editor", { exact: true })).toBeVisible();
  const surface = editorWindow.locator('[data-editor-engine="monaco"][aria-label="Markdown source"]');
  await expect(surface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
  await expect(editorWindow.getByText("Monaco ready", { exact: true })).toHaveCount(0);

  for (const label of ["Format", "Find", "Replace", "Go to line", "Word wrap", "Minimap"] as const) {
    await expect(editorWindow.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  const wordWrap = editorWindow.getByRole("button", { name: "Word wrap", exact: true });
  const minimap = editorWindow.getByRole("button", { name: "Minimap", exact: true });
  await expect(wordWrap).toHaveAttribute("aria-pressed", "false");
  await expect(minimap).toHaveAttribute("aria-pressed", "true");

  const browserInput = editorWindow.getByRole("textbox", {
    name: "Markdown source",
    exact: true,
    includeHidden: true,
  }).first();
  const firstLine = editorWindow.locator(".monaco-editor .view-line").first();
  await expect(firstLine).toBeVisible();
  await firstLine.click({ position: { x: 8, y: 10 } });
  await expect(browserInput).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("# Formatter proof\n\n\n\nParagraph with hard break  \n");
  await expect(editorWindow.getByText("Modified", { exact: true })).toBeVisible();
  const save = editorWindow.getByRole("button", { name: "Save", exact: true });
  await save.click();
  await expect(editorWindow.getByText("Saved", { exact: true })).toBeVisible();

  await editorWindow.getByRole("button", { name: "Format", exact: true }).click();
  await expect(editorWindow.getByText("Markdown formatted", { exact: true })).toBeVisible();
  await expect(editorWindow.getByText("Modified", { exact: true })).toBeVisible();

  await editorWindow.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(editorWindow.getByRole("heading", { name: "Formatter proof", exact: true })).toBeVisible();
  await expect(editorWindow.getByText("Paragraph with hard break", { exact: true })).toBeVisible();
  await editorWindow.getByRole("button", { name: "Edit", exact: true }).click();

  await editorWindow.getByRole("button", { name: "Find", exact: true }).click();
  await expect(editorWindow.locator(".monaco-editor .find-widget")).toBeVisible();
  await page.keyboard.press("Escape");

  await wordWrap.click();
  await minimap.click();
  await expect(wordWrap).toHaveAttribute("aria-pressed", "true");
  await expect(minimap).toHaveAttribute("aria-pressed", "false");

  await save.click();
  await expect(editorWindow.getByText("Saved", { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
