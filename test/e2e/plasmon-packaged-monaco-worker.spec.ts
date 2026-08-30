import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const APP_ID = "plasmon";
const TILE_ID = "main";
const MONACO_WORKERS = [
  "editor.worker.js",
  "json.worker.js",
  "css.worker.js",
  "html.worker.js",
  "ts.worker.js",
] as const;
const BROWSER_TRANSPORT_PATH = `/app/${APP_ID}/runtime/monaco/worker-sources.js`;
const LANGUAGE_SERVICE_SIGNAL_TIMEOUT_MS = 5_000;

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
    `::error title=${browserName} Base Monaco language-service acceptance::${workflowCommandValue(failure)}`,
  );
});

async function focusEditorEnd(page: Page, editor: Locator): Promise<void> {
  const input = editor.getByRole("textbox", {
    name: "Text content",
    exact: true,
    includeHidden: true,
  }).first();
  await editor.locator(".monaco-editor .view-line").last().click({ position: { x: 80, y: 10 } });
  await expect(input).toBeFocused();
  await page.keyboard.press("Control+End");
}

async function expectCompletion(editor: Locator, text: string): Promise<void> {
  const suggestions = editor.locator(".suggest-widget.visible");
  await expect(suggestions, `Monaco completion should include ${text}`).toBeVisible({
    timeout: LANGUAGE_SERVICE_SIGNAL_TIMEOUT_MS,
  });
  await expect(suggestions).toContainText(text, { timeout: LANGUAGE_SERVICE_SIGNAL_TIMEOUT_MS });
}

test("Base packaged Monaco executes all dedicated workers and real language services", async ({
  page,
  request,
  browserName,
}) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const kernelOrigin = new URL(kernelUrl).origin;
  const pageErrors: string[] = [];
  const workerWarnings: string[] = [];
  const externalMonacoRequests: string[] = [];
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
      || text.includes("Missing packaged Monaco worker source")
    ) workerWarnings.push(text);
  });
  page.on("request", (started) => {
    const url = started.url();
    if (!url.toLowerCase().includes("monaco")) return;
    try {
      const parsed = new URL(url);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin !== kernelOrigin) {
        externalMonacoRequests.push(url);
      }
    } catch {
      // blob/data transports are expected and are verified through Worker probes.
    }
  });
  page.on("requestfinished", (finished) => {
    const pathname = decodeURIComponent(new URL(finished.url()).pathname);
    if (pathname === BROWSER_TRANSPORT_PATH) browserTransportLoaded = true;
  });

  const workerBytes = new Map<string, Buffer>();
  const mirrorResponses = await Promise.all(MONACO_WORKERS.map(async (worker) => {
    const programFilesBytes = await readFile(new URL(
      `../../apps/plasmon/public/System/Program Files/MonacoEditor/${worker}`,
      import.meta.url,
    ));
    workerBytes.set(worker, programFilesBytes);
    return [worker, await request.get(new URL(`/app/${APP_ID}/runtime/monaco/${worker}`, kernelUrl).href)] as const;
  }));
  const [transport, retired] = await Promise.all([
    request.get(new URL(BROWSER_TRANSPORT_PATH, kernelUrl).href),
    request.get(new URL(`/app/${APP_ID}/monaco-workers/editor.worker.js`, kernelUrl).href),
  ]);

  expect(transport.ok(), "opaque-origin Monaco worker transport must be served from the installed Base package").toBe(true);
  expect(retired.ok(), "the retired top-level Monaco worker path must not remain packaged").toBe(false);
  for (const [worker, response] of mirrorResponses) {
    expect(response.ok(), `Base Monaco runtime mirror must contain ${worker}`).toBe(true);
    const authority = workerBytes.get(worker)!;
    const mirror = await response.body();
    expect(authority.length, `${worker} Program Files authority must contain runtime bytes`).toBeGreaterThan(100);
    expect(mirror, `${worker} runtime mirror must be byte-identical to Program Files`).toEqual(authority);
  }

  const transportScope: Record<string, unknown> = {};
  runInNewContext(await transport.text(), transportScope);
  const transported = transportScope.__PLASMON_MONACO_WORKER_SOURCES__ as Record<string, string> | undefined;
  expect(Object.keys(transported ?? {}).sort()).toEqual([...MONACO_WORKERS].sort());
  for (const worker of MONACO_WORKERS) {
    expect(
      Buffer.from(transported?.[worker] ?? "", "utf8"),
      `${worker} opaque transport bytes must match Program Files authority`,
    ).toEqual(workerBytes.get(worker));
  }

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

  const fixtures = [
    {
      name: `Base Monaco TypeScript ${Date.now()}.ts`,
      mimeType: "text/typescript",
      content: "const answer: string = 42;\nMath.",
      language: "typescript",
    },
    {
      name: `Base Monaco JSON ${Date.now()}.json`,
      mimeType: "application/json",
      content: '{"enabled": }',
      language: "json",
    },
    {
      name: `Base Monaco CSS ${Date.now()}.css`,
      mimeType: "text/css",
      content: "a { col",
      language: "css",
    },
    {
      name: `Base Monaco HTML ${Date.now()}.html`,
      mimeType: "text/html",
      content: "<di",
      language: "html",
    },
  ] as const;

  for (const fixture of fixtures) {
    const chooserPromise = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…", exact: true }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: Buffer.from(fixture.content, "utf8"),
    });
    await expect(explorer.locator("[data-fm-node-id]", { hasText: fixture.name }).first()).toBeVisible();
  }

  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  try {
    const readWorkers = () => app.locator("html").evaluate(() => (
      (window as Window & { __PLASMON_MONACO_WORKER_PROBE__?: WorkerProbeRecord[] })
        .__PLASMON_MONACO_WORKER_PROBE__ ?? []
    ));

    const openFixture = async (name: string, language: string) => {
      const beforeEditor = await nativeWindows.count();
      await explorer.locator("[data-fm-node-id]", { hasText: name }).first().dblclick();
      await expect(nativeWindows).toHaveCount(beforeEditor + 1, { timeout: 20_000 });
      const editor = nativeWindows.last();
      await expect(editor.getByLabel("Text editor", { exact: true })).toBeVisible();
      const surface = editor.locator('[data-editor-engine="monaco"]').first();
      await expect(surface).toHaveAttribute("data-editor-ready", "true", { timeout: 30_000 });
      await expect(surface).toHaveAttribute("data-editor-language", language);
      return editor;
    };

    const expectWorkerExchange = async (name: string) => {
      await expect.poll(async () => {
        const records = await readWorkers();
        return records.some((record) =>
          record.name === name
          && record.outbound > 0
          && record.inbound > 0
          && record.errors === 0
        );
      }, {
        message: `${browserName} must exchange messages with ${name}`,
        timeout: LANGUAGE_SERVICE_SIGNAL_TIMEOUT_MS,
      }).toBe(true);
    };

    const closeEditor = async (editor: Locator) => {
      const beforeClose = await nativeWindows.count();
      await page.keyboard.press("Escape").catch(() => undefined);
      await editor.getByRole("button", { name: "Close", exact: true }).click();
      await expect(nativeWindows).toHaveCount(beforeClose - 1, { timeout: 10_000 });
    };

    const typescript = await openFixture(fixtures[0].name, fixtures[0].language);
    await expect.poll(
      async () => typescript.locator(".monaco-editor .squiggly-error").count(),
      {
        message: "Base TypeScript must produce a semantic diagnostic",
        timeout: LANGUAGE_SERVICE_SIGNAL_TIMEOUT_MS,
      },
    ).toBeGreaterThan(0);
    await focusEditorEnd(page, typescript);
    await page.keyboard.press("Control+Space");
    await expectCompletion(typescript, "abs");
    await expectWorkerExchange("plasmon-monaco-typescript");
    await closeEditor(typescript);

    const json = await openFixture(fixtures[1].name, fixtures[1].language);
    await expect.poll(
      async () => json.locator(".monaco-editor .squiggly-error").count(),
      {
        message: "Base JSON must produce a language-service diagnostic",
        timeout: LANGUAGE_SERVICE_SIGNAL_TIMEOUT_MS,
      },
    ).toBeGreaterThan(0);
    await expectWorkerExchange("plasmon-monaco-json");
    await closeEditor(json);

    const css = await openFixture(fixtures[2].name, fixtures[2].language);
    await focusEditorEnd(page, css);
    await page.keyboard.press("Control+Space");
    await expectCompletion(css, "color");
    await expectWorkerExchange("plasmon-monaco-css");
    await closeEditor(css);

    const html = await openFixture(fixtures[3].name, fixtures[3].language);
    await focusEditorEnd(page, html);
    await page.keyboard.press("Control+Space");
    await expectCompletion(html, "div");
    await expectWorkerExchange("plasmon-monaco-html");
    await closeEditor(html);

    const workers = (await readWorkers()).filter((record) => record.name.startsWith("plasmon-monaco-"));
    expect(workers.some((worker) => worker.name === "plasmon-monaco-editorWorkerService")).toBe(true);
    for (const worker of workers) {
      expect(worker.type, `${worker.name} must use Neutron's opaque-sandbox classic Worker transport`).toBe("classic");
      expect(worker.origin, `${worker.name} must be constructed inside Neutron's opaque sandbox`).toBe("null");
      expect(worker.url, `${worker.name} must use the packaged opaque-origin transport adapter`).toMatch(/^blob:/u);
      expect(worker.errors, `${worker.name} must not emit Worker errors`).toBe(0);
    }

    expect(browserTransportLoaded, `${browserName} must preload the installed opaque-origin worker transport`).toBe(true);
    expect(externalMonacoRequests, "Base Monaco must not fall back to an external/CDN runtime").toEqual([]);
    expect(workerWarnings, `${browserName} must not fall back from packaged Base Monaco workers`).toEqual([]);
    expect(pageErrors, `${browserName} Base Monaco acceptance must not emit page errors`).toEqual([]);
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
