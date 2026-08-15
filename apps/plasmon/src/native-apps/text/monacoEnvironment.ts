export const MONACO_PROGRAM_FILES_RUNTIME_ROOT = "./System/Program Files/MonacoEditor";
export const MONACO_BROWSER_TRANSPORT_PATH = "./runtime/monaco/worker-sources.js";

export function monacoWorkerFile(label: string): string {
  if (label === "json") return "json.worker.js";
  if (label === "css" || label === "scss" || label === "less") return "css.worker.js";
  if (label === "html" || label === "handlebars" || label === "razor") return "html.worker.js";
  if (label === "typescript" || label === "javascript") return "ts.worker.js";
  return "editor.worker.js";
}

export function monacoWorkerPath(label: string): string {
  return `${MONACO_PROGRAM_FILES_RUNTIME_ROOT}/${monacoWorkerFile(label)}`;
}

export type MonacoWorkerSources = Readonly<Record<string, string>>;

export function monacoWorkerBootstrapSource(label: string, sources: MonacoWorkerSources | undefined): string {
  const filename = monacoWorkerFile(label);
  const source = sources?.[filename];
  if (!source) throw new Error(`Missing packaged Monaco worker source: ${filename}`);
  return source;
}

type MonacoEnvironmentShape = {
  getWorker?: (moduleId: string, label: string) => Worker;
  [key: string]: unknown;
};

type MonacoWorkerScope = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironmentShape;
  __PLASMON_MONACO_WORKER_SOURCES__?: MonacoWorkerSources;
  origin?: string;
};

/**
 * Program Files remains the sole logical Monaco runtime authority. Normal
 * browser origins can construct the packaged module Worker from that path
 * directly. Neutron application frames intentionally have an opaque origin;
 * their package transport is preloaded as inert, byte-identical bundled worker
 * source and used only to materialize a blob: module Worker without crossing
 * the sandbox boundary during Worker startup.
 */
function createMonacoWorker(target: typeof globalThis, label: string): Worker {
  const scope = target as MonacoWorkerScope;
  const options: WorkerOptions = {
    type: "module",
    name: `plasmon-monaco-${label || "editor"}`,
  };
  const workerPath = monacoWorkerPath(label);

  if (scope.origin !== "null") return new Worker(workerPath, options);

  const bootstrap = new Blob(
    [monacoWorkerBootstrapSource(label, scope.__PLASMON_MONACO_WORKER_SOURCES__)],
    { type: "text/javascript" },
  );
  const bootstrapUrl = URL.createObjectURL(bootstrap);
  try {
    return new Worker(bootstrapUrl, options);
  } catch (error: unknown) {
    URL.revokeObjectURL(bootstrapUrl);
    throw error;
  }
}

export function installMonacoEnvironment(target: typeof globalThis = globalThis): void {
  const scope = target as MonacoWorkerScope;
  if (scope.MonacoEnvironment?.getWorker) return;
  const current = scope.MonacoEnvironment ?? {};
  scope.MonacoEnvironment = {
    ...current,
    getWorker: (_moduleId: string, label: string) => createMonacoWorker(target, label),
  };
}
