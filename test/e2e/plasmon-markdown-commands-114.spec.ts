import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const BASIC_MARKDOWN_SOURCE = "# Big Heading\n\nNormal paragraph.\n\n- one\n- two";

test(
  "[demo profile] #114 packaged Markdown exposes formatter, commands, and basic rendered Preview",
  { tag: ["@demo-profile", "@issue-114", "@issue-416"] },
  async ({ page }) => {
    const runtime = resolveLocalNeutronRuntime();
    const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
    const browserHealth = installPlasmonBrowserHealth(page, {
      firstPartyOrigins: [kernelUrl],
      allow: [{
        kind: "console.error",
        messageIncludes: "[Gemma] model load failed Error: The browser did not expose a WebGPU adapter.",
        urlPathPrefix: "/app/gemma/model-worker.js",
        reason: "Full demo deployment includes Gemma; hosted Chromium has no WebGPU adapter for its optional model",
      }],
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

    const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appFrameSelector).first()).toBeAttached();
    const app = page.frameLocator(appFrameSelector).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible();
    await rootShortcut.dblclick();
    const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    await expect(rootExplorer.getByRole("textbox", { name: "Address" })).toHaveValue("/");
    await expect(rootExplorer.getByRole("listbox", { name: "Files" })
      .getByRole("option", { name: "Documents", exact: true })).toBeVisible();
    const address = rootExplorer.getByRole("textbox", { name: "Address" });
    const documentsEntry = rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
    await expect(documentsEntry).toBeVisible();
    await documentsEntry.click();
    await expect(documentsEntry).toHaveAttribute("aria-selected", "true");
    await documentsEntry.press("Enter");
    await expect(address).toHaveValue("/Documents");

    const documentsExplorer = app.locator(".explorer-app").last();
    await expect(documentsExplorer).toBeVisible({ timeout: 20_000 });
    const guide = documentsExplorer.locator("[data-fm-node-id]", { hasText: "Demo Guide.md" }).first();
    await expect(guide).toBeVisible();
    await guide.dblclick();

    const editorWindow = app.getByRole("dialog", { name: "Demo Guide.md - Monaco Editor" }).last();
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
