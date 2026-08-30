import type { DiagnosticLogger } from "../../../os/diagnostics/index.ts";
import { isSlimMonacoProfile } from "../../../os/integration/packageProfile.ts";

export const MONACO_PROGRAM_FILES_RUNTIME_ROOT = "./System/Program Files/MonacoEditor";
export const MONACO_BROWSER_TRANSPORT_PATH = "./runtime/monaco/worker-sources.js";

let monacoDiagnosticLogger: DiagnosticLogger | null = null;

export function setMonacoDiagnosticLogger(logger: DiagnosticLogger | null): void {
  monacoDiagnosticLogger = logger;
}

export function getMonacoDiagnosticLogger(): DiagnosticLogger | null {
  return monacoDiagnosticLogger;
}

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

export function monacoWorkerFile(label: string, slim = isSlimMonacoProfile): string {
  if (slim) return "editor.worker.js";
  if (label === "json") return "json.worker.js";
  if (label === "css" || label === "scss" || label === "less") return "css.worker.js";
  if (label === "html" || label === "handlebars" || label === "razor") return "html.worker.js";
  if (label === "typescript" || label === "javascript") return "ts.worker.js";
  return "editor.worker.js";
}

export function monacoWorkerPath(label: string, slim = isSlimMonacoProfile): string {
  return `${MONACO_PROGRAM_FILES_RUNTIME_ROOT}/${monacoWorkerFile(label, slim)}`;
}

export type MonacoWorkerSources = Readonly<Record<string, string>>;

export function monacoWorkerBootstrapSource(
  label: string,
  sources: MonacoWorkerSources | undefined,
  slim = isSlimMonacoProfile,
): string {
  const filename = monacoWorkerFile(label, slim);
  const source = sources?.[filename];
  if (!source) {
    monacoDiagnosticLogger?.error("runtime.monaco.worker.failed", {
      message: "Packaged Monaco worker source is unavailable",
      runtime: "Monaco",
      stage: "worker-source",
      workerFile: filename,
    });
    throw new Error(`Missing packaged Monaco worker source: ${filename}`);
  }
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

function monacoWorkerName(label: string): string {
  return `plasmon-monaco-${label || "editor"}`;
}

function reportWorkerConstructionFailure(label: string, error: unknown): void {
  monacoDiagnosticLogger?.error("runtime.monaco.worker.failed", {
    message: "Monaco worker could not be constructed",
    runtime: "Monaco",
    stage: "worker-create",
    workerFile: monacoWorkerFile(label),
    errorType: errorType(error),
  });
}

/**
 * Program Files remains the sole logical Monaco runtime authority. Normal
 * browser origins construct the packaged worker from that path directly with
 * module Worker semantics. Neutron application frames intentionally have an
 * opaque origin. Chromium rejects module Workers backed by blob:null URLs in
 * that sandbox even when the blob was created by the same frame, while classic
 * blob Workers execute there. Packaged worker bytes are therefore emitted as a
 * self-contained bundle that is valid in either execution mode: normal origins
 * use the canonical Program Files path as a module Worker, and only the opaque
 * frame materializes the preloaded identical bytes as a classic blob Worker.
 */
function createMonacoWorker(target: typeof globalThis, label: string): Worker {
  const scope = target as MonacoWorkerScope;
  const name = monacoWorkerName(label);
  const workerPath = monacoWorkerPath(label);

  if (scope.origin !== "null") {
    try {
      return new Worker(workerPath, { type: "module", name });
    } catch (error) {
      reportWorkerConstructionFailure(label, error);
      throw error;
    }
  }

  const bootstrap = new Blob(
    [monacoWorkerBootstrapSource(label, scope.__PLASMON_MONACO_WORKER_SOURCES__)],
    { type: "text/javascript" },
  );
  const bootstrapUrl = URL.createObjectURL(bootstrap);
  try {
    return new Worker(bootstrapUrl, { name });
  } catch (error: unknown) {
    URL.revokeObjectURL(bootstrapUrl);
    reportWorkerConstructionFailure(label, error);
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
