import { resolve } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const NES_FIXTURE = resolve("apps/plasmon/dist/web/Games/Test ROMs/PlasmonTest.nes");

test("packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const runtimeRequests: string[] = [];
  const runtimeResponses: string[] = [];
  const runtimeHttpErrors: string[] = [];
  const failedRuntimeRequests: string[] = [];
  const externalRuntimeRequests: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  const isEmulatorRuntimePath = (path: string) =>
    path.includes("/System/Program Files/EmulatorJS/") || path.includes("/runtime/emulatorjs/");

  page.on("request", (request) => {
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    if (isEmulatorRuntimePath(path)) runtimeRequests.push(path);
    if (["cdn.emulatorjs.org", "emulatorjs.org"].includes(url.hostname)) {
      externalRuntimeRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    const path = decodeURIComponent(url.pathname);
    if (isEmulatorRuntimePath(path)) {
      runtimeResponses.push(`${response.status()} ${response.headers()["content-type"] ?? "<no-content-type>"} ${path}`);
      if (response.status() >= 400) runtimeHttpErrors.push(`${response.status()} ${path}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    if (isEmulatorRuntimePath(path)) {
      failedRuntimeRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
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
  await expect(page.locator(appFrameSelector).first()).toBeVisible();
  const app = page.frameLocator(appFrameSelector).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  const files = app.getByRole("listbox", { name: "Files" }).first();
  await expect(files).toBeVisible({ timeout: 30_000 });
  await files.locator('input[type="file"]').setInputFiles(NES_FIXTURE);

  const fixture = app.locator("[data-fm-node-id]", { hasText: "PlasmonTest.nes" }).first();
  await expect(fixture).toBeVisible({ timeout: 30_000 });
  await expect(fixture).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
  await fixture.dblclick();

  const dialog = app.getByRole("dialog", { name: "EmulatorJS" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const runtimeRoot = dialog.locator('[data-emulatorjs-runtime-host="true"]');
  await expect(runtimeRoot).toHaveCount(1);
  const host = dialog.locator('iframe[title="NES game"]');
  const emulator = app.frameLocator('iframe[title="NES game"]');

  const optionalText = async (locator: Locator): Promise<string | null> => {
    if (await locator.count() === 0) return null;
    return await locator.first().textContent();
  };

  const runtimeState = async () => {
    const hostCount = await host.count();
    const [phase, runtimeError, alertText, statusText] = await Promise.all([
      runtimeRoot.getAttribute("data-emulatorjs-phase"),
      runtimeRoot.getAttribute("data-emulatorjs-error"),
      optionalText(dialog.locator('[role="alert"]')),
      optionalText(dialog.locator('[role="status"]')),
    ]);

    let init: string | null = null;
    let bootstrap: string | null = null;
    let loaded: string | null = null;
    let ready: string | null = null;
    let body = "<iframe absent>";
    let bodyHtml = "<iframe absent>";
    if (hostCount > 0) {
      const currentHost = host.first();
      [init, bootstrap, loaded, ready] = await Promise.all([
        currentHost.getAttribute("data-emulatorjs-init"),
        currentHost.getAttribute("data-emulatorjs-bootstrap"),
        currentHost.getAttribute("data-emulatorjs-loaded"),
        currentHost.getAttribute("data-emulatorjs-ready"),
      ]);
      const frameBody = await currentHost.evaluate((element) => {
        try {
          const runtimeFrame = element as HTMLIFrameElement;
          return {
            text: runtimeFrame.contentDocument?.body?.innerText ?? "<body unavailable>",
            html: runtimeFrame.contentDocument?.body?.innerHTML ?? "<body unavailable>",
          };
        } catch (error) {
          return { text: `<body inaccessible: ${String(error)}>`, html: "<body inaccessible>" };
        }
      });
      body = frameBody.text;
      bodyHtml = frameBody.html;
    }

    return JSON.stringify({
      phase,
      runtimeError,
      hostCount,
      init,
      bootstrap,
      loaded,
      ready,
      body: body.replace(/\s+/gu, " ").trim().slice(0, 600),
      bodyHtml: bodyHtml.replace(/\s+/gu, " ").trim().slice(0, 900),
      alert: alertText?.replace(/\s+/gu, " ").trim().slice(0, 600) ?? null,
      status: statusText?.replace(/\s+/gu, " ").trim().slice(0, 600) ?? null,
      requests: runtimeRequests.slice(-12),
      responses: runtimeResponses.slice(-12),
      httpErrors: runtimeHttpErrors.slice(-8),
      failedRequests: failedRuntimeRequests.slice(-8),
      externalRequests: externalRuntimeRequests.slice(-8),
      pageErrors: pageErrors.slice(-8),
      consoleErrors: consoleErrors.slice(-8),
    });
  };

  try {
    await expect.poll(
      async () => {
        if (await host.count() > 0 && await host.first().getAttribute("data-emulatorjs-loaded") === "true") {
          return "loaded";
        }
        return await runtimeState();
      },
      { timeout: 30_000, message: "EmulatorJS loader should initialize from packaged assets" },
    ).toBe("loaded");
  } catch (error) {
    const state = await runtimeState();
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`EmulatorJS loader should initialize from packaged assets\nRuntime state: ${state}\n${cause}`);
  }

  try {
    await expect.poll(
      async () => {
        if (await host.count() > 0 && await host.first().getAttribute("data-emulatorjs-ready") === "true") {
          return "ready";
        }
        return await runtimeState();
      },
      { timeout: 90_000, message: "EmulatorJS core and NES fixture should start" },
    ).toBe("ready");
  } catch (error) {
    const state = await runtimeState();
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`EmulatorJS core and NES fixture should start\nRuntime state: ${state}\n${cause}`);
  }

  await expect(emulator.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  expect(runtimeRequests.some((path) => path.endsWith("/data/loader.js"))).toBe(true);
  expect(runtimeRequests.some((path) => path.endsWith("/data/emulator.min.js"))).toBe(true);
  expect(runtimeRequests.some((path) => path.endsWith("/data/emulator.min.css"))).toBe(true);
  expect(runtimeRequests.some((path) => /\/data\/cores\/fceumm(?:-legacy)?-wasm\.data$/u.test(path))).toBe(true);
  expect(externalRuntimeRequests).toEqual([]);
  expect(runtimeHttpErrors).toEqual([]);
  expect(failedRuntimeRequests).toEqual([]);
  expect(pageErrors).toEqual([]);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });
  await expect(app.locator('iframe[title="NES game"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
