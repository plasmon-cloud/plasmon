import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";

test("diagnostic text selects without stealing FileEntry drag", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [{
      kind: "console.warn",
      messageIncludes: "WARN | [file-manager] | file-manager.move.failed | file-manager.move.failed | context={\"failed\":1,\"succeeded\":0,\"total\":1}",
      reason: "this scenario deliberately creates one same-name move collision to expose the selectable FileManager diagnostic",
    }],
  });
  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    await page.locator("[data-tid=launcher-open]").click();
    await page.locator(`[data-tid=launcher-tile-${APP_ID}-${TILE_ID}]`).click();
    const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();

    const root = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(root).toBeVisible({ timeout: 30_000 });
    await root.dblclick();
    const explorer = app.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(explorer).toHaveCount(1);
    const address = explorer.getByRole("textbox", { name: "Address" });
    await expect(address).toHaveValue("/");
    const explorerId = await explorer.getAttribute("data-window-id");
    if (!explorerId) throw new Error("Explorer native window has no stable window id");
    const explorerWindow = app.locator(`.plasmon-window-layer [data-window-id="${explorerId}"]`);
    const fileManager = explorerWindow.getByRole("listbox", { name: "Files" });
    await expect(fileManager).toBeVisible();

    // Keep the complete collision journey on the already-proven root Explorer
    // surface. `/Desktop` is a virtual desktop projection rather than a stable
    // address-navigation boundary, so using it here would couple this selection
    // gate to an unrelated namespace contract. Capture generated names so retries
    // remain independent of filesystem state left by an earlier attempt.
    const openFileManagerMenu = async () => {
      const position = await fileManager.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const maxY = Math.min(rect.height - 16, Math.max(48, rect.height * 0.4));
        for (let y = 24; y <= maxY; y += 16) {
          for (let x = Math.max(16, rect.width - 16); x >= 16; x -= 16) {
            const hit = document.elementFromPoint(rect.left + x, rect.top + y);
            if (!(hit instanceof Element) || !element.contains(hit)) continue;
            if (hit.closest(
              "[data-fm-node-id], button, input, textarea, select, a, [role='button'], [role='menuitem']",
            )) continue;
            return { x, y };
          }
        }
        return null;
      });
      if (!position) throw new Error("FileManager has no exposed background point for context menu");
      await fileManager.click({ button: "right", position });
      const menu = explorerWindow.getByRole("menu", { name: "Folder background context menu" });
      await expect(menu).toBeVisible();
      return explorerWindow;
    };

    await clickNewContextMenuItem(await openFileManagerMenu(), "New Text Document");
    const sourceRename = explorerWindow.getByRole("textbox", { name: /^Rename New Text Document(?: \(\d+\))?\.txt$/ }).last();
    await expect(sourceRename).toBeVisible();
    const sourceDocumentName = await sourceRename.inputValue();
    await sourceRename.press("Escape");
    await expect(sourceRename).toHaveCount(0);

    await clickNewContextMenuItem(await openFileManagerMenu(), "New Folder");
    const folderRename = explorerWindow.getByRole("textbox", { name: /^Rename New Folder(?: \(\d+\))?$/ }).last();
    await expect(folderRename).toBeVisible();
    const collisionFolderName = await folderRename.inputValue();
    await folderRename.press("Escape");
    await expect(folderRename).toHaveCount(0);

    const collisionFolder = fileManager.locator("[data-fm-node-id]", { hasText: collisionFolderName }).first();
    await expect(collisionFolder).toBeVisible();
    await collisionFolder.dblclick();
    await expect(address).toHaveValue(`/${collisionFolderName}`);

    await clickNewContextMenuItem(await openFileManagerMenu(), "New Text Document");
    const nestedRename = explorerWindow.getByRole("textbox", { name: /^Rename New Text Document(?: \(\d+\))?\.txt$/ }).last();
    await expect(nestedRename).toBeVisible();
    await nestedRename.fill(sourceDocumentName);
    await nestedRename.press("Enter");
    await expect(nestedRename).toHaveCount(0);

    const upOneLevel = explorerWindow.getByRole("button", { name: "Up one level" });
    await expect(upOneLevel).toBeEnabled();
    await upOneLevel.click();
    // Return through Explorer's real navigation command instead of relying on
    // address-submit timing. Prove both the visible address and the command
    // state reached the root before resolving same-named collision entries.
    await expect(address).toHaveValue("/");
    await expect(upOneLevel).toBeDisabled();
    const targetFolder = fileManager.locator("[data-fm-node-id]", { hasText: collisionFolderName }).first();
    const sourceEntry = fileManager.locator("[data-fm-node-id]", { hasText: sourceDocumentName }).first();
    await expect(targetFolder).toBeVisible();
    await expect(sourceEntry).toBeVisible();
    const sourceBox = await sourceEntry.boundingBox();
    const targetBox = await targetFolder.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Move-collision entries have no bounds");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await expect(sourceEntry).toHaveClass(/is-dragging/);
    await page.mouse.up();

    const diagnostic = explorerWindow.getByRole("alert").last();
    await expect(diagnostic).toBeVisible();
    const message = diagnostic.locator("span").first();
    const diagnosticText = await message.innerText();
    expect(diagnosticText.length).toBeGreaterThan(8);
    await expect(message).toHaveCSS("user-select", "text");

    const diagnosticBox = await message.boundingBox();
    if (!diagnosticBox) throw new Error("Diagnostic message has no bounds");
    await page.mouse.move(diagnosticBox.x + 2, diagnosticBox.y + diagnosticBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      diagnosticBox.x + Math.max(40, diagnosticBox.width - 2),
      diagnosticBox.y + diagnosticBox.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();

    const selectedText = await message.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selectedText).toContain(diagnosticText.slice(0, Math.min(12, diagnosticText.length)));
    await expect(fileManager.locator("[data-fm-node-id].is-dragging")).toHaveCount(0);

    const dismiss = diagnostic.getByRole("button", { name: "Dismiss" });
    await expect(dismiss).toHaveCSS("user-select", "none");
    await dismiss.click();
    await expect(diagnostic).toHaveCount(0);

    // The same source entry must remain an ordinary draggable FileEntry after
    // the diagnostic selection gesture and dismissal.
    await expect(sourceEntry).toBeVisible();
    const entryBox = await sourceEntry.boundingBox();
    if (!entryBox) throw new Error("FileEntry has no bounds");
    await page.mouse.move(entryBox.x + entryBox.width / 2, entryBox.y + entryBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      entryBox.x + entryBox.width / 2 + 24,
      entryBox.y + entryBox.height / 2 + 24,
      { steps: 5 },
    );
    await expect(sourceEntry).toHaveClass(/is-dragging/);
    await page.mouse.up();

    const expectedMoveWarnings = health.ledger.allowedIssues().filter((issue) =>
      issue.kind === "console.warn"
      && issue.message.includes("[file-manager] | file-manager.move.failed |"));
    expect(expectedMoveWarnings).toHaveLength(1);
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
