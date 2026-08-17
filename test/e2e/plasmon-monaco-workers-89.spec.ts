import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const BROWSER_TRANSPORT_PATH = `/app/${APP_ID}/runtime/monaco/worker-sources.js`;

type WorkerProbeRecord = {
  url: string;
  name: string;
  type: string;
  origin: string;
  outbound: number;
  inbound: number;
  errors: number;
};

function workflowCommandValue(value: string): string {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

test.afterEach(async ({ browserName }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  if (testInfo.retry < testInfo.project.retries) return;
  const failure = testInfo.error?.message ?? `status=${testInfo.status}`;
  console.log(
    `::error title=#89 ${browserName} Monaco worker acceptance::${workflowCommandValue(failure)}`,
  );
});

test("#89 packaged Monaco workers use Program Files authority through the opaque-origin transport", async ({
  page,
  request,
  browserName,
}, testInfo) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  const workerWarnings: string[] = [];
  let browserTransportLoaded = false;

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
    if (pathname === BROWSER_TRANSPORT_PATH) browserTransportLoaded = true;
  });

  const transport = await request.get(new URL(BROWSER_TRANSPORT_PATH, kernelUrl).href);
  expect(transport.ok(), "opaque-origin Monaco worker transport must be served from the installed package").toBe(true);
  const httpMirror = await request.get(new URL(`/app/${APP_ID}/runtime/monaco/editor.worker.js`, kernelUrl).href);
  expect(httpMirror.ok(), "the URL-safe Monaco serving mirror must remain installed").toBe(true);
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

  // FileManager's New Text Document command intentionally persists text/plain,
  // and canonical resource classification gives persisted MIME precedence over
  // a later filename change. Import a real TypeScript resource instead so this
  // acceptance actually exercises Monaco's TypeScript worker without weakening
  // the filesystem MIME authority or any worker assertion below.
  const probeName = `Monaco Worker Probe ${testInfo.retry}.ts`;
  const chooserPromise = page.waitForEvent("filechooser");
  await explorer.getByRole("button", { name: "Import Files…", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: probeName,
    mimeType: "text/typescript",
    buffer: Buffer.from("", "utf8"),
  });

  const entry = explorer.locator("[data-fm-node-id]", { hasText: probeName }).first();
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
    expect(worker.type, `${worker.name} must use the opaque-sandbox classic Worker compatibility path`).toBe("classic");
    expect(worker.origin, `${worker.name} must be constructed inside Neutron's opaque sandbox`).toBe("null");
    expect(worker.url, `${worker.name} must use the opaque-origin transport adapter`).toMatch(/^blob:/u);
    expect(worker.errors, `${worker.name} must not emit Worker errors`).toBe(0);
  }

  expect(browserTransportLoaded, `${browserName} must preload the installed opaque-origin worker transport`).toBe(true);
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
