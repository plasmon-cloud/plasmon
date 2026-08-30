import {
  describeApp,
  listApps,
  listEndpoints,
  offerAppInstall,
  openAppTile,
} from "neutron-tools/app";
import type { DiagnosticLogger } from "../diagnostics/index.ts";
import type { VanillaNeutronApi } from "./types.ts";

export const MAX_CONCURRENT_FRONTEND_CALLS_PER_ENDPOINT = 8;

type Waiter = {
  callId: number;
  name: string;
  queuedAtMs: number;
  resolve: () => void;
};

type ActiveCall = {
  callId: number;
  name: string;
  startedAtMs: number;
};

export type FrontendCallAdmission = <T>(
  name: string,
  operation: () => Promise<T>,
) => Promise<T>;

export interface FrontendCallAdmissionOptions {
  now?: () => number;
  diagnosticLogger?: () => DiagnosticLogger | null;
}

let sharedDiagnosticLogger: DiagnosticLogger | null = null;

/**
 * Attach the canonical production logger to the one shared caller-endpoint
 * admission lane. Construction remains silent until diagnostics can truthfully
 * exist; callers must not create a second admission semaphore merely to log it.
 */
export function setFrontendCallAdmissionDiagnosticLogger(
  logger: DiagnosticLogger | null,
): void {
  sharedDiagnosticLogger = logger;
}

/**
 * Bound Plasmon's normal frontend-tool traffic at the same authority boundary
 * Kernel uses for admission: one caller endpoint, regardless of which Plasmon
 * subsystem initiated the call.
 *
 * Filesystem invalidation can fan out across Desktop, Explorer, Search, and
 * dialogs while the foreground Neutron bridge is also issuing Kernel calls.
 * Kernel rejects a ninth concurrent normal call from one endpoint, so separate
 * per-subsystem semaphores are insufficient. Queue excess calls here instead of
 * teaching individual surfaces about Kernel transport limits.
 */
export function createFrontendCallAdmission(
  maximum = MAX_CONCURRENT_FRONTEND_CALLS_PER_ENDPOINT,
  options: FrontendCallAdmissionOptions = {},
): FrontendCallAdmission {
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new Error("Frontend call concurrency must be a positive integer");
  }

  const now = options.now ?? Date.now;
  const logDebug = (event: string, context: Record<string, unknown>): void => {
    try {
      options.diagnosticLogger?.()?.debug(event, context);
    } catch {
      // Admission must remain correct even if an injected observer is defective.
    }
  };
  let active = 0;
  let nextCallId = 0;
  const waiters: Waiter[] = [];
  const activeCalls = new Map<number, ActiveCall>();

  const start = (callId: number, name: string): void => {
    active += 1;
    activeCalls.set(callId, { callId, name, startedAtMs: now() });
  };

  const acquire = (name: string, callId: number): Promise<boolean> => {
    if (active < maximum) {
      start(callId, name);
      return Promise.resolve(false);
    }

    const queuedAtMs = now();
    logDebug("neutron.frontend-call.queued", {
      callId,
      name,
      active,
      queued: waiters.length + 1,
      maximum,
      activeCalls: [...activeCalls.values()],
    });

    return new Promise<boolean>((resolve) => {
      waiters.push({
        callId,
        name,
        queuedAtMs,
        resolve: () => resolve(true),
      });
    });
  };

  const admitNext = (): void => {
    const next = waiters.shift();
    if (!next) return;
    // Reserve the released slot synchronously before waking the waiter. Without
    // this reservation, a newly arriving call can barge into the gap and the
    // resumed waiter can raise active above the configured maximum.
    start(next.callId, next.name);
    logDebug("neutron.frontend-call.admitted", {
      callId: next.callId,
      name: next.name,
      waitMs: now() - next.queuedAtMs,
      active,
      queued: waiters.length,
      maximum,
    });
    next.resolve();
  };

  const release = (callId: number, queued: boolean): void => {
    const current = activeCalls.get(callId);
    activeCalls.delete(callId);
    active -= 1;
    if (queued) {
      logDebug("neutron.frontend-call.completed", {
        callId,
        name: current?.name,
        durationMs: current === undefined ? undefined : now() - current.startedAtMs,
        active,
        queued: waiters.length,
        maximum,
      });
    }
    admitNext();
  };

  return async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    const callId = nextCallId += 1;
    const queued = await acquire(name, callId);
    try {
      return await operation();
    } finally {
      release(callId, queued);
    }
  };
}

export const admitFrontendToolCall = createFrontendCallAdmission(
  MAX_CONCURRENT_FRONTEND_CALLS_PER_ENDPOINT,
  { diagnosticLogger: () => sharedDiagnosticLogger },
);

/** Normal Kernel calls used by the production vanilla bridge share the same
 * caller-endpoint admission lane as hosted filesystem RPC. */
export const admittedVanillaNeutronApi: VanillaNeutronApi = {
  listApps: () => admitFrontendToolCall("kernel:apps.list", () => listApps()),
  describeApp: (appId) => admitFrontendToolCall(
    "kernel:apps.describe",
    () => describeApp(appId),
  ),
  listEndpoints: () => admitFrontendToolCall(
    "kernel:endpoints.list",
    () => listEndpoints(),
  ),
  openAppTile: (request) => admitFrontendToolCall(
    "kernel:workspace.open_tile",
    () => openAppTile(request),
  ),
  offerAppInstall: (request) => admitFrontendToolCall(
    "kernel:apps.offer_install",
    () => offerAppInstall(request),
  ),
};
