import { expect, test, type Frame, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_SELECTOR = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';

async function launchPackagedPlasmon(page: Page): Promise<Frame> {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  const iframe = page.locator(PLASMON_SELECTOR).first();
  await expect(iframe).toBeVisible();
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error("Packaged Plasmon iframe did not expose a browser frame");
  await expect(frame.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return frame;
}

test("full remote experiment routes canonical diagnostics through the packaged Rollbar adapter", async ({ page }) => {
  const reports: string[] = [];
  await page.route("https://api.rollbar.com/**", async (route) => {
    if (route.request().method() === "POST") reports.push(route.request().postData() ?? "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"err":0,"result":{"uuid":"plasmon-ci-probe"}}',
    });
  });

  const app = await launchPackagedPlasmon(page);
  const installed = await app.evaluate(() => {
    const target = window as Window & {
      __plasmonRemoteIncidentExperiment?: (variant?: "same" | "different") => void;
    };
    return typeof target.__plasmonRemoteIncidentExperiment === "function";
  });
  expect(installed).toBe(true);

  await app.evaluate(() => {
    const target = window as Window & {
      __plasmonRemoteIncidentExperiment?: (variant?: "same" | "different") => void;
    };
    target.__plasmonRemoteIncidentExperiment?.();
  });

  await expect.poll(() => reports.length, { timeout: 10_000 }).toBeGreaterThan(0);
  const payload = reports.join("\n");
  expect(payload).toContain("remote.synthetic.failed");
  expect(payload).toContain("remote-experiment-same");
});

test("experimental packaged Plasmon can reach Rollbar HTTPS API from its real iframe", async ({ page }) => {
  const app = await launchPackagedPlasmon(page);
  const result = await app.evaluate(async () => {
    try {
      // no-cors deliberately isolates the Neutron/browser connect boundary from
      // whether this diagnostic ping endpoint itself exposes CORS headers. A
      // CSP/connect-src denial, DNS failure, or network failure still rejects.
      const response = await fetch("https://api.rollbar.com/api/1/status/ping", {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
      });
      return { reached: true, type: response.type, status: response.status };
    } catch (error) {
      return {
        reached: false,
        type: "error",
        status: -1,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      };
    }
  });

  expect(result.reached).toBe(true);
  expect(result.type).toBe("opaque");
  expect(result.status).toBe(0);
});
