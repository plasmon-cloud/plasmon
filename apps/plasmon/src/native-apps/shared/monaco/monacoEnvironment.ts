import {
  DiagnosticEvent,
  DiagnosticRuntime,
  DiagnosticStage,
  DiagnosticSubsystem,
  type DiagnosticLogger,
} from "../../../os/diagnostics/index.ts";
import { isSlimMonacoProfile } from "../../../os/integration/packageProfile.ts";

export const MONACO_PROGRAM_FILES_RUNTIME_ROOT = "./System/Program Files/MonacoEditor";
export const MONACO_BROWSER_TRANSPORT_PATH = "./runtime/monaco/worker-sources.js";

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

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

function reportWorkerFailure(
  log: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeMonaco> | undefined,
  label: string,
  stage: typeof DiagnosticStage.WorkerSource | typeof DiagnosticStage.WorkerCreate,
  error?: unknown,
): void {
  log?.error(DiagnosticEvent.RuntimeMonaco.WorkerFailed, {
    message: stage === DiagnosticStage.WorkerSource
      ? "Packaged Monaco worker source is unavailable"
      : "Monaco worker could not be constructed",
    runtime: DiagnosticRuntime.Monaco,
    stage,
    workerFile: monacoWorkerFile(label),
    ...(error === undefined ? {} : { errorType: errorType(error) }),
  });
}

function monacoWorkerName(label: string): string {
  return `plasmon-monaco-${label || "editor"}`;
}

/**
 * Program Files remains the sole logical Monaco runtime authority. Normal
 * browser origins construct the packaged worker from that path directly with
 * module Worker semantics. Neutron application frames intentionally have an
 * opaque origin, so only that boundary materializes packaged worker bytes as a
 * classic blob Worker. The scoped logger is captured by this installed adapter;
 * no runtime-global logger registry is required.
 */
function createMonacoWorker(
  target: typeof globalThis,
  label: string,
  diagnosticLogger?: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeMonaco>,
): Worker {
  const scope = target as MonacoWorkerScope;
  const name = monacoWorkerName(label);
  const workerPath = monacoWorkerPath(label);

  if (scope.origin !== "null") {
    try {
      return new Worker(workerPath, { type: "module", name });
    } catch (error) {
      reportWorkerFailure(diagnosticLogger, label, "worker-create", error);
      throw error;
    }
  }

  let bootstrapSource: string;
  try {
    bootstrapSource = monacoWorkerBootstrapSource(label, scope.__PLASMON_MONACO_WORKER_SOURCES__);
  } catch (error) {
    reportWorkerFailure(diagnosticLogger, label, "worker-source", error);
    throw error;
  }

  const bootstrap = new Blob([bootstrapSource], { type: "text/javascript" });
  const bootstrapUrl = URL.createObjectURL(bootstrap);
  try {
    return new Worker(bootstrapUrl, { name });
  } catch (error: unknown) {
    URL.revokeObjectURL(bootstrapUrl);
    reportWorkerFailure(diagnosticLogger, label, "worker-create", error);
    throw error;
  }
}

export function installMonacoEnvironment(
  target: typeof globalThis = globalThis,
  diagnosticLogger?: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeMonaco>,
): void {
  const scope = target as MonacoWorkerScope;
  if (scope.MonacoEnvironment?.getWorker) return;
  const current = scope.MonacoEnvironment ?? {};
  scope.MonacoEnvironment = {
    ...current,
    getWorker: (_moduleId: string, label: string) => createMonacoWorker(target, label, diagnosticLogger),
  };
}
