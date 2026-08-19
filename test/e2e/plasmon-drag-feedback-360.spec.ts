import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

async function launchPlasmon(page: import("@playwright/test").Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  expect(principal).toBe(runtime.developerIdentityPrincipal);
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
  const frame = page.frameLocator(selector).first();
  const files = frame.getByRole("listbox", { name: "Files" }).first();
  await expect(files).toBeVisible({ timeout: 30_000 });
  return { frame, files, health };
}

test("#360 Desktop drag ghost preserves entry identity and lands where it previews", async ({ page }) => {
  const { frame, files, health } = await launchPlasmon(page);
  try {
    const source = files.getByRole("option").first();
    await expect(source).toBeVisible();
    const sourceId = await source.getAttribute("data-fm-node-id");
    if (!sourceId) throw new Error("Desktop drag source has no stable NodeId");
    const sourceName = (await source.locator(".fm-entry__name").textContent())?.trim();
    if (!sourceName) throw new Error("Desktop drag source has no visible filename");
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Desktop drag source has no browser bounds");

    const dx = 36;
    const dy = 24;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + dx,
      sourceBox.y + sourceBox.height / 2 + dy,
      { steps: 6 },
    );

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-fm-drag-source-id", sourceId);
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__icon")).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__name")).toHaveText(sourceName);
    await expect(preview).toHaveCSS("pointer-events", "none");

    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error("Desktop drag preview has no browser bounds");
    expect(Math.abs(previewBox.x - (sourceBox.x + dx))).toBeLessThanOrEqual(2);
    expect(Math.abs(previewBox.y - (sourceBox.y + dy))).toBeLessThanOrEqual(2);

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    const committed = files.locator(`[data-fm-node-id="${sourceId}"]`);
    await expect(committed).toBeVisible();
    const committedBox = await committed.boundingBox();
    if (!committedBox) throw new Error("Committed Desktop entry has no browser bounds");
    expect(Math.abs(committedBox.x - previewBox.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(committedBox.y - previewBox.y)).toBeLessThanOrEqual(4);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

test("#360 folder hover names the canonical move target and release moves the file", async ({ page }) => {
  const { frame, files, health } = await launchPlasmon(page);
  try {
    const root = frame.locator('[data-fm-node-id]', { hasText: "Root" }).first();
    await expect(root).toBeVisible();
    await root.dblclick();

    const explorer = frame.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(explorer).toHaveCount(1);
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/");
    const explorerFiles = explorer.getByRole("listbox", { name: "Files" });
    const commandBar = explorerFiles.getByRole("toolbar", { name: "File commands" });
    await commandBar.getByRole("button", { name: "New Text Document" }).click();
    const rename = explorerFiles.getByRole("textbox", { name: /^Rename New Text Document/ });
    await expect(rename).toBeVisible();
    const createdName = await rename.inputValue();
    await rename.press("Enter");

    const source = explorerFiles.locator('[data-fm-node-id][data-fm-kind="file"]', { hasText: createdName }).first();
    const destination = explorerFiles.locator('[data-fm-node-id][data-fm-kind="directory"]', { hasText: "Documents" }).first();
    await expect(source).toBeVisible();
    await expect(destination).toBeVisible();
    const sourceId = await source.getAttribute("data-fm-node-id");
    const destinationId = await destination.getAttribute("data-fm-node-id");
    if (!sourceId || !destinationId) throw new Error("Directory drop participants need stable NodeIds");
    const sourceBox = await source.boundingBox();
    const destinationBox = await destination.boundingBox();
    if (!sourceBox || !destinationBox) throw new Error("Directory drop participants have no browser bounds");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      destinationBox.x + destinationBox.width / 2,
      destinationBox.y + destinationBox.height / 2,
      { steps: 8 },
    );

    const preview = frame.locator('[data-fm-drag-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__icon")).toBeVisible();
    await expect(preview.locator(".fm-drag-preview__entry .fm-entry__name")).toHaveText(createdName);
    await expect(destination).toHaveClass(/is-drop-target/);
    await expect(preview).toHaveAttribute("data-fm-drop-target-id", destinationId);
    await expect(preview.locator('[data-fm-drag-feedback="true"]')).toHaveText("Move to Documents");

    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(explorerFiles.locator(`[data-fm-node-id="${sourceId}"]`)).toHaveCount(0);

    await destination.dblclick();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/Documents");
    await expect(explorerFiles.locator(`[data-fm-node-id="${sourceId}"]`)).toBeVisible();
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
