import { expect, test } from "@playwright/test";
import { runInNewContext } from "node:vm";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const BROWSER_WORKER_PATH = `/app/${APP_ID}/runtime/monaco/editor.worker.js`;
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
    `::error title=#391 ${browserName} slim Monaco worker acceptance::${workflowCommandValue(failure)}`,
  );
});

test("#391 slim packaged Monaco executes the installed editor-worker through the opaque-origin transport", { tag: ["@issue-89", "@issue-391"] }, async ({
  page,
  request,
  browserName,
}) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
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

  // Package-level coverage proves the canonical Program Files worker inventory.
  // The installed browser boundary exposes the generated URL-safe mirror and
  // opaque preload derived from that same canonical byte stream.
  const [mirror, transport, missingMirrorTypescript, retired] = await Promise.all([
    request.get(new URL(BROWSER_WORKER_PATH, kernelUrl).href),
    request.get(new URL(BROWSER_TRANSPORT_PATH, kernelUrl).href),
    request.get(new URL(`/app/${APP_ID}/runtime/monaco/ts.worker.js`, kernelUrl).href),
    request.get(new URL(`/app/${APP_ID}/monaco-workers/editor.worker.js`, kernelUrl).href),
  ]);
  expect(mirror.ok(), "slim Monaco URL-safe editor-worker mirror must remain installed").toBe(true);
  expect(transport.ok(), "opaque-origin Monaco worker transport must be served from the installed package").toBe(true);
  expect(missingMirrorTypescript.ok(), "slim r2 must not expose a shadow ts.worker.js mirror").toBe(false);
  expect(retired.ok(), "the retired top-level Monaco worker path must not remain packaged").toBe(false);

  const mirrorBytes = await mirror.body();
  expect(mirrorBytes.length, "installed editor-worker mirror must contain runtime bytes").toBeGreaterThan(100);
  const transportScope: Record<string, unknown> = {};
  runInNewContext(await transport.text(), transportScope);
  const transported = transportScope.__PLASMON_MONACO_WORKER_SOURCES__ as Record<string, string> | undefined;
  expect(Object.keys(transported ?? {}), "slim opaque transport must preload only the shipped editor worker").toEqual([
    "editor.worker.js",
  ]);
  expect(
    Buffer.from(transported?.["editor.worker.js"] ?? "", "utf8"),
    "opaque transport bytes must be byte-identical to the installed editor-worker mirror",
  ).toEqual(mirrorBytes);

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

  const probeName = `Monaco Slim Worker Probe ${Date.now()}.js`;
  const chooserPromise = page.waitForEvent("filechooser");
  await explorer.getByRole("button", { name: "Import Files…", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: probeName,
    mimeType: "text/javascript",
    buffer: Buffer.from(
      "const answer = 42;\nfunction twice(value) { return value * 2; }\nconst result = twice(answer);",
      "utf8",
    ),
  });

  const entry = explorer.locator("[data-fm-node-id]", { hasText: probeName }).first();
  await expect(entry).toBeVisible();
  const beforeEditor = await nativeWindows.count();
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  try {
    await entry.dblclick();
    await expect(nativeWindows).toHaveCount(beforeEditor + 1, { timeout: 20_000 });

    const editor = nativeWindows.last();
    await expect(editor.getByLabel("Text editor", { exact: true })).toBeVisible();
    const surface = editor.locator('[data-editor-engine="monaco"]').first();
    await expect(surface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
    await expect(surface).toHaveAttribute("data-editor-language", "javascript");
    await expect(editor.getByText("JavaScript", { exact: true })).toBeVisible();

    await expect.poll(
      async () => editor.locator(".monaco-editor .view-line").evaluateAll((lines) => {
        const classes = new Set<string>();
        for (const line of lines) {
          for (const span of line.querySelectorAll('span[class*="mtk"]')) {
            for (const className of span.classList) {
              if (/^mtk\d+$/.test(className)) classes.add(className);
            }
          }
        }
        return classes.size;
      }),
      { message: "slim Text/Monaco must retain visible JavaScript syntax tokenization" },
    ).toBeGreaterThan(1);

    const readWorkers = () => app.locator("html").evaluate(() => (
      (window as Window & { __PLASMON_MONACO_WORKER_PROBE__?: WorkerProbeRecord[] })
        .__PLASMON_MONACO_WORKER_PROBE__ ?? []
    ));

    await expect.poll(async () => {
      const records = await readWorkers();
      return records.some((record) =>
        record.name === "plasmon-monaco-editorWorkerService"
        && record.outbound > 0
        && record.inbound > 0
        && record.errors === 0
      );
    }, {
      message: `${browserName} must exercise the real slim editor worker through Monaco`,
      timeout: 20_000,
    }).toBe(true);

    const workers = (await readWorkers()).filter((record) => record.name.startsWith("plasmon-monaco-"));
    expect(workers.length).toBeGreaterThanOrEqual(1);
    for (const worker of workers) {
      expect(worker.type, `${worker.name} must use the opaque-sandbox classic Worker compatibility path`).toBe("classic");
      expect(worker.origin, `${worker.name} must be constructed inside Neutron's opaque sandbox`).toBe("null");
      expect(worker.url, `${worker.name} must use the opaque-origin transport adapter`).toMatch(/^blob:/u);
      expect(worker.errors, `${worker.name} must not emit Worker errors`).toBe(0);
    }

    expect(browserTransportLoaded, `${browserName} must preload the installed opaque-origin worker transport`).toBe(true);
    expect(workerWarnings, `${browserName} must not fall back from the real slim Monaco worker`).toEqual([]);
    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
    __PLASMON_MONACO_WORKER_PROBE__?: WorkerProbeRecord[];
  }
}
