import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

function rectOf(locator: import("@playwright/test").Locator) {
  return locator.boundingBox().then((box) => {
    if (!box) throw new Error("Search geometry target has no browser rectangle");
    return box;
  });
}

function assertViewportContained(box: { x: number; y: number; width: number; height: number }, viewport: { width: number; height: number }, label: string): void {
  expect(box.x, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test("#175 browser specification — Search frame and controls survive category density changes", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [],
  });
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("#175 requires a fixed Playwright viewport");
  const plasmon = page.frameLocator('iframe[data-app-id="plasmon"][data-tile-id="main"]').first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  await plasmon.getByRole("button", { name: "Search" }).click();
  const search = plasmon.getByRole("region", { name: "Search" });
  await expect(search).toBeVisible();
  const input = search.getByLabel("Search Plasmon");
  const tabs = search.getByRole("tablist");
  const resultRegion = search.locator(".plasmon-shell__results");
  const baseline = {
    frame: await rectOf(search),
    input: await rectOf(input),
    tabs: await rectOf(tabs),
  };
  assertViewportContained(baseline.frame, viewport, "Search frame");

  for (const category of ["Apps", "Documents", "Media", "Atoms"]) {
    await search.getByRole("tab", { name: category, exact: true }).click();
    await expect(search.getByRole("tab", { name: category, exact: true })).toHaveAttribute("aria-selected", "true");
    const frame = await rectOf(search);
    const inputBox = await rectOf(input);
    const tabsBox = await rectOf(tabs);
    assertViewportContained(frame, viewport, `${category} frame`);
    expect(Math.abs(frame.x - baseline.frame.x), `${category} frame x drift`).toBeLessThan(4);
    expect(Math.abs(frame.y - baseline.frame.y), `${category} frame y drift`).toBeLessThan(4);
    expect(Math.abs(frame.width - baseline.frame.width), `${category} frame width drift`).toBeLessThan(4);
    expect(Math.abs(frame.height - baseline.frame.height), `${category} frame height drift`).toBeLessThan(12);
    expect(Math.abs(inputBox.x - baseline.input.x), `${category} input x drift`).toBeLessThan(4);
    expect(Math.abs(inputBox.y - baseline.input.y), `${category} input y drift`).toBeLessThan(4);
    expect(Math.abs(tabsBox.x - baseline.tabs.x), `${category} tabs x drift`).toBeLessThan(4);
    expect(Math.abs(tabsBox.y - baseline.tabs.y), `${category} tabs y drift`).toBeLessThan(4);
  }

  await input.fill("__plasmon_geometry_no_such_resource__");
  await expect(search.getByText("No results in this category.")).toBeVisible();
  const emptyFrame = await rectOf(search);
  assertViewportContained(emptyFrame, viewport, "empty Search frame");
  expect(Math.abs(emptyFrame.width - baseline.frame.width)).toBeLessThan(4);
  expect(Math.abs(emptyFrame.height - baseline.frame.height)).toBeLessThan(12);

  await input.fill("");
  const resultMetrics = await resultRegion.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(resultMetrics.clientHeight).toBeGreaterThan(0);
  // The accepted production fixture must contain enough results for this
  // boundary. Do not fake overflow with a test stylesheet or mount a
  // replacement surface.
  expect(resultMetrics.scrollHeight, "Search result region must own overflow for the populated fixture")
    .toBeGreaterThan(resultMetrics.clientHeight);
  const body = await rectOf(resultRegion);
  assertViewportContained(body, viewport, "Search result region");
});
