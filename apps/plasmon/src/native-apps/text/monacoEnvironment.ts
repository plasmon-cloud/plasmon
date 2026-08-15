export const MONACO_PROGRAM_FILES_RUNTIME_ROOT = "./System/Program Files/MonacoEditor";
export const MONACO_BROWSER_TRANSPORT_ROOT = "./runtime/monaco";

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

export function monacoWorkerBrowserPath(label: string): string {
  return `${MONACO_BROWSER_TRANSPORT_ROOT}/${monacoWorkerFile(label)}`;
}

/**
 * Sandboxed Neutron application frames have an opaque origin. Kernel app-host
 * serving requires a URL-safe package-local transport for assets beneath paths
 * with spaces, so the opaque frame cannot import the logical Program Files URL
 * directly. The transport bytes are copied from the canonical Program Files
 * workers during build and are not a second Monaco runtime authority.
 */
export function monacoWorkerBootstrapSource(label: string, baseHref: string): string {
  const workerUrl = new URL(monacoWorkerBrowserPath(label), baseHref).href;
  return `import ${JSON.stringify(workerUrl)};\n`;
}

type MonacoEnvironmentShape = {
  getWorker?: (moduleId: string, label: string) => Worker;
  [key: string]: unknown;
};

type MonacoWorkerScope = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironmentShape;
  origin?: string;
};

function createMonacoWorker(target: typeof globalThis, label: string): Worker {
  const scope = target as MonacoWorkerScope;
  const options: WorkerOptions = {
    type: "module",
    name: `plasmon-monaco-${label || "editor"}`,
  };
  const workerPath = monacoWorkerPath(label);

  if (scope.origin !== "null") return new Worker(workerPath, options);
  if (!scope.location?.href) {
    throw new Error("Monaco cannot resolve its Program Files worker from an opaque origin");
  }

  const bootstrap = new Blob(
    [monacoWorkerBootstrapSource(label, scope.location.href)],
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
