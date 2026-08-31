import { DiagnosticCategory, DiagnosticEvent, DiagnosticSource, DiagnosticSubsystem } from "./vocabulary.ts";
import type { DiagnosticService } from "./service.ts";

const MAX_RECENT_FAILURES = 32;
const MAX_STACK_FRAMES = 8;
const SAFE_ERROR_NAME = /^[A-Za-z_$][A-Za-z0-9_$.-]{0,79}$/;
const CHROME_STACK_FRAME = /^\s*at\s+([A-Za-z_$<][A-Za-z0-9_$.[\]<>:-]{0,119})(?:\s+\(|$)/;
const FIREFOX_STACK_FRAME = /^([A-Za-z_$<][A-Za-z0-9_$.[\]<>:-]{0,119})@/;

export interface RuntimeDiagnosticEventTarget {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface RuntimeDiagnosticCapture {
  /** React root callback. Deliberately use only onUncaughtError, never onCaughtError. */
  readonly onReactUncaughtError: (error: unknown) => void;
  dispose(): void;
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  try {
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === "string" ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function safeErrorName(error: unknown): string {
  const candidate = error instanceof Error
    ? error.name
    : readStringProperty(error, "name");
  return candidate && SAFE_ERROR_NAME.test(candidate) ? candidate : "Error";
}

function safeStack(error: unknown, name: string): string | undefined {
  const rawStack = error instanceof Error
    ? error.stack
    : readStringProperty(error, "stack");
  if (!rawStack) return undefined;

  const frames: string[] = [];
  for (const line of rawStack.split("\n").slice(1)) {
    const match = CHROME_STACK_FRAME.exec(line) ?? FIREFOX_STACK_FRAME.exec(line.trim());
    if (!match?.[1]) continue;
    frames.push(`at ${match[1]}`);
    if (frames.length >= MAX_STACK_FRAMES) break;
  }
  return frames.length > 0 ? [name, ...frames].join("\n") : undefined;
}

function safeDiagnosticError(error: unknown): Error {
  const name = safeErrorName(error);
  const projected = new Error("Unexpected uncaught runtime failure");
  projected.name = name;
  projected.stack = safeStack(error, name);
  return projected;
}

function objectIdentity(value: unknown): object | null {
  return (typeof value === "object" && value !== null) || typeof value === "function"
    ? value as object
    : null;
}

/**
 * Install the one application-owned boundary for genuinely uncaught browser and React failures.
 * Product modules do not opt in. The listeners are observational only and never prevent default
 * browser behavior. Raw messages, filenames, URLs, rejection payloads, and component stacks are
 * intentionally excluded before the canonical diagnostic sanitizer runs.
 */
export function installRuntimeDiagnosticCapture(
  diagnostics: DiagnosticService,
  target: RuntimeDiagnosticEventTarget = window,
): RuntimeDiagnosticCapture {
  const log = diagnostics.for(DiagnosticSubsystem.Runtime);
  const recentObjects = new WeakSet<object>();
  const recentQueue: object[] = [];
  let active = true;

  const claimFailure = (failure: unknown): boolean => {
    const identity = objectIdentity(failure);
    if (!identity) return true;
    if (recentObjects.has(identity)) return false;
    recentObjects.add(identity);
    recentQueue.push(identity);
    if (recentQueue.length > MAX_RECENT_FAILURES) {
      const expired = recentQueue.shift();
      if (expired) recentObjects.delete(expired);
    }
    return true;
  };

  const emit = (
    failure: unknown,
    event: typeof DiagnosticEvent.Runtime.UncaughtError | typeof DiagnosticEvent.Runtime.UnhandledRejection,
    source: typeof DiagnosticSource.WindowError | typeof DiagnosticSource.UnhandledRejection | typeof DiagnosticSource.ReactRoot,
  ): void => {
    if (!active || !claimFailure(failure)) return;
    log.error(event, {
      message: event === DiagnosticEvent.Runtime.UncaughtError
        ? "Uncaught Product runtime failure"
        : "Unhandled Product Promise rejection",
      category: event === DiagnosticEvent.Runtime.UncaughtError
        ? DiagnosticCategory.UncaughtException
        : DiagnosticCategory.UnhandledRejection,
      source,
      error: safeDiagnosticError(failure),
    });
  };

  const onWindowError: EventListener = (event) => {
    const browserEvent = event as ErrorEvent;
    emit(browserEvent.error, DiagnosticEvent.Runtime.UncaughtError, DiagnosticSource.WindowError);
  };
  const onUnhandledRejection: EventListener = (event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    emit(rejectionEvent.reason, DiagnosticEvent.Runtime.UnhandledRejection, DiagnosticSource.UnhandledRejection);
  };

  target.addEventListener("error", onWindowError);
  target.addEventListener("unhandledrejection", onUnhandledRejection);

  return {
    onReactUncaughtError: (error: unknown) => {
      emit(error, DiagnosticEvent.Runtime.UncaughtError, DiagnosticSource.ReactRoot);
    },
    dispose: () => {
      if (!active) return;
      active = false;
      target.removeEventListener("error", onWindowError);
      target.removeEventListener("unhandledrejection", onUnhandledRejection);
      recentQueue.length = 0;
    },
  };
}
