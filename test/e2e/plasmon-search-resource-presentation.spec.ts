import { expect, test, type Locator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const WIDE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAEklEQVR4nGP8z4AdMOEQJ0MCAGSRAQfIidsoAAAAAElFTkSuQmCC", "base64");
const TALL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAICAIAAABRUclSAAAAFElEQVR4nGNkYPjPAANMDEiAuhwAaEMBD80tnoAAAAAASUVORK5CYII=", "base64");

type BrowserFixture = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

function installStrictBrowserHealth(page: Page): () => void {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console.error: ${message.text()}`);
  });
  return () => expect(failures, failures.join("\n")).toEqual([]);
}

async function finishElementAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function expectDesktopFixture(plasmon: ReturnType<Page["frameLocator"]>, name: string): Promise<void> {
  await expect(plasmon.getByRole("option").filter({ hasText: name })).toBeVisible();
}

async function importDesktopFixture(
  plasmon: ReturnType<Page["frameLocator"]>,
  importer: Locator,
  fixture: BrowserFixture,
): Promise<void> {
  await importer.setInputFiles(fixture);
  await expectDesktopFixture(plasmon, fixture.name);
  await expect(plasmon.locator(".fm-operation-status")).toHaveCount(0);
  await expectDesktopFixture(plasmon, fixture.name);
}

function expectNear(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1);
}

test("Search keeps sparse rows compact and renders real resource thumbnails", async ({ page }) => {
  const assertBrowserHealthy = installStrictBrowserHealth(page);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();
  const selector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
  await expect(page.locator(selector).first()).toBeVisible();
  const plasmon = page.frameLocator(selector).first();
  await expect(plasmon.getByRole("button", { name: "Search" })).toBeVisible({ timeout: 30_000 });

  const importer = plasmon.locator('input[type="file"][multiple]').first();
  for (const fixture of [
    { name: "issue426-wide.png", mimeType: "image/png", buffer: WIDE_PNG },
    { name: "issue426-tall.png", mimeType: "image/png", buffer: TALL_PNG },
    { name: "issue426-note.txt", mimeType: "text/plain", buffer: Buffer.from("issue 426 document") },
  ] satisfies BrowserFixture[]) {
    await importDesktopFixture(plasmon, importer, fixture);
  }

  await plasmon.getByRole("button", { name: "Search" }).click();
  const panel = plasmon.getByRole("region", { name: "Search" });
  const tabs = panel.getByRole("tablist");
  const results = panel.locator(".plasmon-shell__results");
  await finishElementAnimations(panel);
  await panel.getByRole("textbox", { name: "Search Plasmon" }).fill("issue426-");

  const baselinePanel = await panel.boundingBox();
  const baselineTabs = await tabs.boundingBox();
  const baselineResults = await results.boundingBox();
  if (!baselinePanel || !baselineTabs || !baselineResults) throw new Error("Search geometry unavailable");

  const mediaTab = panel.getByRole("tab", { name: "Media", exact: true });
  await mediaTab.click();
  const mediaRows = results.locator("[data-search-result]");
  await expect(mediaRows).toHaveCount(2);
  const firstBox = await mediaRows.nth(0).boundingBox();
  const secondBox = await mediaRows.nth(1).boundingBox();
  if (!firstBox || !secondBox) throw new Error("Media row geometry unavailable");
  expect(firstBox.height).toBeGreaterThanOrEqual(47);
  expect(firstBox.height).toBeLessThanOrEqual(60);
  expect(secondBox.height).toBeLessThanOrEqual(60);
  expect(firstBox.y - baselineResults.y).toBeLessThanOrEqual(2);
  expect(secondBox.y - firstBox.y).toBeLessThanOrEqual(64);
  expect(baselineResults.height - (secondBox.y + secondBox.height - baselineResults.y)).toBeGreaterThan(80);

  for (const [name, naturalWidth, naturalHeight] of [
    ["issue426-wide.png", 8, 4],
    ["issue426-tall.png", 4, 8],
  ] as const) {
    const row = mediaRows.filter({ hasText: name });
    const image = row.locator("img.plasmon-media-thumbnail");
    await expect(image).toBeVisible();
    expect(await image.evaluate((element) => ({
      objectFit: getComputedStyle(element).objectFit,
      naturalWidth: (element as HTMLImageElement).naturalWidth,
      naturalHeight: (element as HTMLImageElement).naturalHeight,
    }))).toEqual({ objectFit: "contain", naturalWidth, naturalHeight });
  }

  await importDesktopFixture(plasmon, importer, {
    name: "issue426-unavailable.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(0),
  });
  await expect(mediaRows).toHaveCount(3);
  const unavailableRow = mediaRows.filter({ hasText: "issue426-unavailable.png" });
  await expect(unavailableRow.locator("img.plasmon-media-thumbnail")).toHaveCount(0);
  await expect(unavailableRow.locator("img.plasmon-icon-art:not(.plasmon-media-thumbnail)")).toBeVisible();

  const documentsTab = panel.getByRole("tab", { name: "Documents", exact: true });
  await documentsTab.click();
  const documentRows = results.locator("[data-search-result]");
  await expect(documentRows).toHaveCount(1);
  const documentBox = await documentRows.first().boundingBox();
  if (!documentBox) throw new Error("Document row geometry unavailable");
  expect(documentBox.height).toBeLessThanOrEqual(60);
  expect(documentBox.y - baselineResults.y).toBeLessThanOrEqual(2);
  await expect(documentRows.first().locator(".plasmon-icon-frame--bare img.plasmon-icon-art")).toBeVisible();

  for (const category of ["All", "Apps", "Documents", "Media", "Atoms"] as const) {
    const tab = panel.getByRole("tab", { name: category, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const currentPanel = await panel.boundingBox();
    const currentTabs = await tabs.boundingBox();
    const currentResults = await results.boundingBox();
    if (!currentPanel || !currentTabs || !currentResults) throw new Error(`${category} geometry unavailable`);
    expectNear(currentPanel.x, baselinePanel.x, `${category} panel x`);
    expectNear(currentPanel.y, baselinePanel.y, `${category} panel y`);
    expectNear(currentPanel.width, baselinePanel.width, `${category} panel width`);
    expectNear(currentPanel.height, baselinePanel.height, `${category} panel height`);
    expectNear(currentTabs.x, baselineTabs.x, `${category} tabs x`);
    expectNear(currentTabs.y, baselineTabs.y, `${category} tabs y`);
    expectNear(currentTabs.width, baselineTabs.width, `${category} tabs width`);
    expectNear(currentResults.height, baselineResults.height, `${category} results height`);
  }

  assertBrowserHealthy();
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
