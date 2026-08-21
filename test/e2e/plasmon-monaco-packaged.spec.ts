import { expect, test, type Route } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const FIXTURE_PARAM = "plasmon-fixture";
const FIXTURE_VALUE = "first-demo";

type BrowserPageError = {
  name: string;
  message: string;
  stack?: string;
};

test(
  "packaged Text and Markdown edit save and reopen through real Monaco",
  { tag: ["@issue-67", "@issue-285"] },
  async ({ page }) => {
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

    // #285 keeps this acceptance focused on the real Monaco/package boundary.
    // Use #181's ordinary production filesystem bootstrap instead of coupling
    // Monaco readiness to unrelated Explorer create/rename setup.
    const fixtureRoute = `**/app/${APP_ID}/**`;
    let fixtureRedirected = false;
    const redirectInitialPlasmonDocument = async (route: Route) => {
      const requestUrl = new URL(route.request().url());
      const appRoot = `/app/${APP_ID}/`;
      const isMainDocument = route.request().resourceType() === "document"
        && (requestUrl.pathname === appRoot || requestUrl.pathname === `${appRoot}index.html`);
      if (!isMainDocument || requestUrl.searchParams.get(FIXTURE_PARAM) === FIXTURE_VALUE) {
        await route.continue();
        return;
      }

      fixtureRedirected = true;
      requestUrl.searchParams.set(FIXTURE_PARAM, FIXTURE_VALUE);
      await route.fulfill({
        status: 307,
        headers: {
          location: requestUrl.href,
          "cache-control": "no-store",
        },
      });
    };
    await page.route(fixtureRoute, redirectInitialPlasmonDocument);

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
    expect(fixtureRedirected, "installed Plasmon should boot with the explicit first-demo flag").toBe(true);

    const appFrameSelector = `iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`;
    await expect(page.locator(appFrameSelector).first()).toBeAttached();
    const app = page.frameLocator(appFrameSelector).first();
    await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
    const activeAppUrl = new URL(await app.locator("html").evaluate(() => window.location.href));
    expect(activeAppUrl.searchParams.get(FIXTURE_PARAM)).toBe(FIXTURE_VALUE);
    await page.unroute(fixtureRoute, redirectInitialPlasmonDocument);

    const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
    const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();

    const rootExplorer = app.getByRole("dialog", { name: "This Plasmon" }).last();
    await expect(rootExplorer).toBeVisible({ timeout: 20_000 });
    const documents = rootExplorer.locator("[data-fm-node-id]", { hasText: "Documents" }).first();
    await expect(documents).toBeVisible();
    await documents.dblclick();

    const documentsExplorer = app.getByRole("dialog", { name: "Documents" }).last();
    await expect(documentsExplorer).toBeVisible({ timeout: 20_000 });
    const notes = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Notes.txt" }).first();
    const guide = documentsExplorer.locator("[data-fm-node-id]", { hasText: "First Demo Guide.md" }).first();
    await expect(notes).toBeVisible();
    await expect(guide).toBeVisible();

    const expectNoPageErrors = (label: string): void => {
      expect(pageErrors, label).toEqual([]);
    };

    const openDocument = async (entry: ReturnType<typeof documentsExplorer.locator>, appLabel: string) => {
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
      entry: ReturnType<typeof documentsExplorer.locator>;
      appLabel: "Text editor" | "Markdown editor";
      sourceLabel: "Text content" | "Markdown source";
      persistedText: string;
    }) => {
      const opened = await openDocument(options.entry, options.appLabel);
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
      await page.keyboard.press("Control+A");
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

      const reopened = await openDocument(options.entry, options.appLabel);
      await waitForUsableMonaco(reopened.editorWindow, `${options.appLabel} after reopen`);
      await expect(reopened.editorWindow.locator(".monaco-editor .view-line").first()).toHaveText(options.persistedText);
      expectNoPageErrors(`${options.appLabel} reopen must preserve exact content without browser errors`);
      await closeDocument(reopened.before, reopened.editorWindow, `${options.appLabel} reopened close`);
    };

    await exercisePackagedEditor({
      entry: notes,
      appLabel: "Text editor",
      sourceLabel: "Text content",
      persistedText: "packaged text persisted",
    });
    await exercisePackagedEditor({
      entry: guide,
      appLabel: "Markdown editor",
      sourceLabel: "Markdown source",
      persistedText: "packaged markdown persisted",
    });

    expectNoPageErrors("packaged Monaco acceptance must finish without unexplained browser errors");
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
