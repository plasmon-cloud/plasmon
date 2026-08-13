import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const ICON_PREFIX = `/app/${PLASMON_APP_ID}/static/plasmon/icons/`;

function pathname(value: string): string {
  return new URL(value).pathname;
}

test("#190 installed Plasmon requests shared icon assets from its application mount", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const iconRequests: string[] = [];
  const iconResponses = new Map<string, number>();

  page.on("request", (request) => {
    const path = pathname(request.url());
    if (path.includes("/static/plasmon/icons/")) iconRequests.push(path);
  });
  page.on("response", (response) => {
    const path = pathname(response.url());
    if (path.includes("/static/plasmon/icons/")) iconResponses.set(path, response.status());
  });

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
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  await expect(plasmon.getByRole("listbox", { name: "Files" }).first()).toBeVisible();

  await expect.poll(() => new Set(iconRequests).size, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);

  const requested = [...new Set(iconRequests)];
  expect(requested.every((path) => path.startsWith(ICON_PREFIX)), `shared icon requests: ${requested.join(", ")}`).toBe(true);

  for (const name of ["file.svg", "folder.svg", "recycle-bin.svg", "shortcut-overlay.svg"] as const) {
    const path = `${ICON_PREFIX}${name}`;
    expect(requested, `${path} should be requested by the real installed surface`).toContain(path);
    expect(iconResponses.get(path), `${path} should load successfully`).toBe(200);
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
