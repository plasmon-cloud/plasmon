import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";
const BASIC_MARKDOWN_SOURCE = "# Big Heading\n\nNormal paragraph.\n\n- one\n- two";
const COMPACT_HEADING_SOURCE = "#hello";

test(
  "#114 packaged Markdown exposes formatter, commands, and basic rendered Preview",
  { tag: ["@r2-quarantine", "@issue-114", "@issue-416", "@issue-507"] },
  async ({ page }) => {
    const runtime = resolveLocalNeutronRuntime();
    const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
    const browserHealth = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

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

    await firstLine.click({ position: { x: 8, y: 10 } });
    await expect(browserInput).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(BASIC_MARKDOWN_SOURCE);
    await save.click();
    await expect(editorWindow.getByText("Saved", { exact: true })).toBeVisible();

    const previewButton = editorWindow.getByRole("button", { name: "Preview", exact: true });
    await previewButton.click();
    const preview = editorWindow.getByRole("article", { name: "Markdown preview" });
    const heading = preview.getByRole("heading", { name: "Big Heading", exact: true, level: 1 });
    const paragraph = preview.getByText("Normal paragraph.", { exact: true });
    const list = preview.getByRole("list");
    const listItems = list.locator("li");

    await expect(heading).toBeVisible();
    await expect(paragraph).toBeVisible();
    await expect(list).toBeVisible();
    await expect(listItems).toHaveCount(2);
    await expect(listItems.nth(0)).toHaveText("one");
    await expect(listItems.nth(1)).toHaveText("two");
    await expect(preview).not.toContainText("# Big Heading");

    const presentation = await preview.evaluate((article) => {
      const h1 = article.querySelector("h1")!;
      const p = article.querySelector("p")!;
      const ul = article.querySelector("ul")!;
      const li = article.querySelector("li")!;
      const headingStyle = getComputedStyle(h1);
      const paragraphStyle = getComputedStyle(p);
      const listStyle = getComputedStyle(ul);
      const itemStyle = getComputedStyle(li);
      return {
        headingSize: Number.parseFloat(headingStyle.fontSize),
        paragraphSize: Number.parseFloat(paragraphStyle.fontSize),
        headingWeight: Number.parseInt(headingStyle.fontWeight, 10),
        listStyleType: listStyle.listStyleType,
        listPaddingLeft: Number.parseFloat(listStyle.paddingLeft),
        itemDisplay: itemStyle.display,
      };
    });
    expect(presentation.headingSize).toBeGreaterThan(presentation.paragraphSize);
    expect(presentation.headingWeight).toBeGreaterThanOrEqual(600);
    expect(presentation.listStyleType).not.toBe("none");
    expect(presentation.listPaddingLeft).toBeGreaterThan(0);
    expect(presentation.itemDisplay).toBe("list-item");

    await editorWindow.getByRole("button", { name: "Split", exact: true }).click();
    await expect(heading).toBeVisible();
    await expect(list).toBeVisible();
    await expect(surface).toBeVisible();

    // #416 compatibility: the installed Preview accepts a standalone compact
    // top-level heading, while the editor/persisted source remains literal.
    await editorWindow.getByRole("button", { name: "Edit", exact: true }).click();
    await firstLine.click({ position: { x: 8, y: 10 } });
    await expect(browserInput).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(COMPACT_HEADING_SOURCE);
    await save.click();
    await expect(editorWindow.getByText("Saved", { exact: true })).toBeVisible();

    await previewButton.click();
    const compactHeading = preview.getByRole("heading", { name: "hello", exact: true, level: 1 });
    await expect(compactHeading).toBeVisible();
    await expect(preview).not.toContainText(COMPACT_HEADING_SOURCE);

    await editorWindow.getByRole("button", { name: "Split", exact: true }).click();
    await expect(compactHeading).toBeVisible();
    await expect(firstLine).toContainText(COMPACT_HEADING_SOURCE);
    await expect(surface).toBeVisible();

    await editorWindow.getByRole("button", { name: "Edit", exact: true }).click();
    await editorWindow.getByRole("button", { name: "Find", exact: true }).click();
    await expect(editorWindow.locator(".monaco-editor .find-widget")).toBeVisible();
    await page.keyboard.press("Escape");

    await wordWrap.click();
    await minimap.click();
    await expect(wordWrap).toHaveAttribute("aria-pressed", "true");
    await expect(minimap).toHaveAttribute("aria-pressed", "false");

    browserHealth.assertClean();
    browserHealth.dispose();
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
