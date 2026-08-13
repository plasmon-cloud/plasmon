import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

test("#190 RED — packaged shared Plasmon assets load from the installed package mount", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  // Match the accepted #187 packaged-health baseline. The two historical
  // /static/plasmon/icons allowances are intentionally absent: this gate must
  // fail on the #190 defect without broadening or deleting unrelated waivers.
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      { kind: "pageerror", message: "Canceled", reason: "Monaco cancellation lifecycle allowance from #187" },
      { kind: "console.warn", messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute", urlPathPrefix: "/chunks/", reason: "Kernel-owned iframe warning from #187" },
      { kind: "console.warn", messageIncludes: "Could not create web worker(s). Falling back to loading web worker code in main thread", urlPathPrefix: "/app/plasmon/main.js", reason: "Tracked Monaco worker issue #67/#200" },
      { kind: "console.warn", messageIncludes: "cannot be accessed from origin 'null'", urlPathPrefix: "/app/plasmon/main.js", reason: "Tracked opaque-origin Monaco worker issue #67/#200" },
      { kind: "console.error", messageIncludes: "Failed to execute 'estimate' on 'StorageManager'", reason: "Tracked js-dos sandbox issue #202" },
      { kind: "console.error", messageIncludes: "Storage directory access is denied because the context is sandboxed", reason: "Tracked js-dos sandbox issue #202" },
      { kind: "console.warn", messageIncludes: "Can't create audio node with sampleRate === 0", urlPathPrefix: "/app/plasmon/runtime/jsdos/js-dos.js", reason: "js-dos headless audio diagnostic from #187" },
      { kind: "console.warn", messageIncludes: "GPU stall due to ReadPixels", urlPathPrefix: "/app/plasmon/index.html", reason: "Chromium software-rendering diagnostic from #187" },
    ],
  });
  const failed: string[] = [];
  const loaded: string[] = [];
  page.on("requestfailed", (request) => {
    if (/\/static\/plasmon\/icons\//u.test(new URL(request.url()).pathname)) failed.push(request.url());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (/\/app\/plasmon\/static\/plasmon\/icons\//u.test(url.pathname) && response.ok()) loaded.push(url.href);
  });
  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    await page.locator('[data-tid="launcher-open"]').click();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
    const selector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(selector)).toBeVisible();
    const plasmon = page.frameLocator(selector);
    await expect(plasmon.getByRole("listbox", { name: "Files" }).first()).toBeVisible({ timeout: 30_000 });
    const icon = plasmon.locator('img[src*="/static/plasmon/icons/"]').first();
    await expect(icon).toBeVisible();
    const resolved = await icon.evaluate((element) => (element as HTMLImageElement).currentSrc || (element as HTMLImageElement).src);
    expect(new URL(resolved).pathname, "shared asset must resolve inside installed Plasmon package").toMatch(/\/app\/plasmon\/static\/plasmon\/icons\//u);
    expect(loaded.length, "at least one installed shared asset response must succeed").toBeGreaterThan(0);
    expect(failed, "first-party shared icon requests must not fail").toEqual([]);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global { interface Window { __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>; } }
