import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const CANONICAL_WORKER_ROOT = `/app/${APP_ID}/System/Program Files/MonacoEditor/`;

type WorkerProbeRecord = {
  url: string;
  name: string;
  type: string;
  origin: string;
  outbound: number;
  inbound: number;
  errors: number;
};

test("#89 packaged Monaco workers run from Program Files through the opaque-origin adapter", async ({
  page,
  request,
  browserName,
}) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  const workerWarnings: string[] = [];
  const canonicalWorkerRequests = new Set<string>();

  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const records: WorkerProbeRecord[] = [];
    Object.defineProperty(window, "__PLASMON_MONACO_WORKER_PROBE__", {
      configurable: false,
      enumerable: false,
      value: records,
    });
    if (!NativeWorker) return;

    const InstrumentedWorker = new Proxy(NativeWorker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args, target) as Worker;
        const options = args[1] as WorkerOptions | undefined;
        const record: WorkerProbeRecord = {
          url: String(args[0]),
          name: options?.name ?? "",
          type: options?.type ?? "classic",
          origin: globalThis.origin,
          outbound: 0,
          inbound: 0,
          errors: 0,
        };
        records.push(record);

        const nativePostMessage = worker.postMessage;
        Object.defineProperty(worker, "postMessage", {
          configurable: true,
          value: (...postArgs: unknown[]) => {
            record.outbound += 1;
            return Reflect.apply(nativePostMessage, worker, postArgs);
          },
        });
        worker.addEventListener("message", () => { record.inbound += 1; });
        worker.addEventListener("error", () => { record.errors += 1; });
        return worker;
      },
    });
    Object.defineProperty(window, "Worker", {
      configurable: true,
      writable: true,
      value: InstrumentedWorker,
    });
  });

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "warning" && message.type() !== "error") return;
    const text = message.text();
    if (
      text.includes("Could not create web worker(s)")
      || text.includes("cannot be accessed from origin 'null'")
      || text.includes("may not load data from")
    ) workerWarnings.push(text);
  });
  page.on("requestfinished", (finished) => {
    const pathname = decodeURIComponent(new URL(finished.url()).pathname);
    if (pathname.startsWith(CANONICAL_WORKER_ROOT)) canonicalWorkerRequests.add(pathname);
  });

  for (const file of ["editor.worker.js", "ts.worker.js"]) {
    const response = await request.get(new URL(`${CANONICAL_WORKER_ROOT}${file}`, kernelUrl).href);
    expect(response.ok(), `${file} must be served from the canonical installed package path`).toBe(true);
  }
  const retired = await request.get(new URL(`/app/${APP_ID}/monaco-workers/editor.worker.js`, kernelUrl).href);
  expect(retired.ok(), "the retired top-level Monaco worker path must not remain packaged").toBe(false);

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

  const app = page.frameLocator(`iframe[data-app-id="${APP_ID}"][data-tile-id="${TILE_ID}"]`).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  const nativeWindows = app.locator(".plasmon-window-layer [data-window-id]");
  const beforeExplorer = await nativeWindows.count();
  const rootShortcut = app.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();
  await expect(nativeWindows).toHaveCount(beforeExplorer + 1, { timeout: 20_000 });

  const explorer = nativeWindows.last();
  await expect(explorer.getByLabel("File Explorer", { exact: true })).toBeVisible();
  await explorer.getByRole("button", { name: "New Text Document", exact: true }).click();
  const rename = explorer.getByRole("textbox", { name: /^Rename New Text Document/ }).first();
  await expect(rename).toBeVisible();
  await rename.fill("Monaco Worker Probe.ts");
  await rename.press("Enter");

  const entry = explorer.locator("[data-fm-node-id]", { hasText: "Monaco Worker Probe.ts" }).first();
  await expect(entry).toBeVisible();
  const beforeEditor = await nativeWindows.count();
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  await entry.dblclick();
  await expect(nativeWindows).toHaveCount(beforeEditor + 1, { timeout: 20_000 });

  const editor = nativeWindows.last();
  await expect(editor.getByLabel("Text editor", { exact: true })).toBeVisible();
  const surface = editor.locator('[data-editor-engine="monaco"]').first();
  await expect(surface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
  const input = editor.getByRole("textbox", {
    name: "Text content",
    exact: true,
    includeHidden: true,
  }).first();
  const firstLine = editor.locator(".monaco-editor .view-line").first();
  await expect(firstLine).toBeVisible();
  await firstLine.click({ position: { x: 8, y: 10 } });
  await expect(input).toBeFocused();
  await page.keyboard.insertText("const plasmonWorkerProbe = 1;\nplasmonWorkerProbe.");
  await page.keyboard.press("Control+Space");

  const readWorkers = () => app.locator("html").evaluate(() => (
    (window as Window & { __PLASMON_MONACO_WORKER_PROBE__?: WorkerProbeRecord[] })
      .__PLASMON_MONACO_WORKER_PROBE__ ?? []
  ));

  await expect.poll(async () => {
    const records = await readWorkers();
    return ["plasmon-monaco-editorWorkerService", "plasmon-monaco-typescript"]
      .every((name) => records.some((record) => record.name === name));
  }, {
    message: `${browserName} must construct the editor and TypeScript Monaco workers`,
    timeout: 20_000,
  }).toBe(true);

  await expect.poll(async () => {
    const records = (await readWorkers()).filter((record) =>
      record.name === "plasmon-monaco-editorWorkerService"
      || record.name === "plasmon-monaco-typescript",
    );
    return records.length >= 2
      && records.every((record) => record.outbound > 0 && record.inbound > 0 && record.errors === 0);
  }, {
    message: `${browserName} Monaco workers must exchange messages without worker errors`,
    timeout: 20_000,
  }).toBe(true);

  const workers = (await readWorkers()).filter((record) => record.name.startsWith("plasmon-monaco-"));
  expect(workers.length).toBeGreaterThanOrEqual(2);
  for (const worker of workers) {
    expect(worker.type, `${worker.name} must preserve module Worker semantics`).toBe("module");
    expect(worker.origin, `${worker.name} must be constructed inside Neutron's opaque sandbox`).toBe("null");
    expect(worker.url, `${worker.name} must use the opaque-origin transport adapter`).toMatch(/^blob:/u);
    expect(worker.errors, `${worker.name} must not emit Worker errors`).toBe(0);
  }

  expect(
    [...canonicalWorkerRequests].some((path) => path.endsWith("/editor.worker.js")),
    `${browserName} must load the editor worker code from Program Files`,
  ).toBe(true);
  expect(
    [...canonicalWorkerRequests].some((path) => path.endsWith("/ts.worker.js")),
    `${browserName} must load the TypeScript worker code from Program Files`,
  ).toBe(true);
  expect(workerWarnings, `${browserName} must not fall back from real Monaco workers`).toEqual([]);
  expect(pageErrors, `${browserName} worker acceptance must not emit page errors`).toEqual([]);
  health.assertClean();
  health.dispose();
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
    __PLASMON_MONACO_WORKER_PROBE__?: WorkerProbeRecord[];
  }
}
