import {
  describeApp,
  listApps,
  listEndpoints,
  offerAppInstall,
  openAppTile,
} from "neutron-tools/app";
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
): FrontendCallAdmission {
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new Error("Frontend call concurrency must be a positive integer");
  }

  let active = 0;
  let nextCallId = 0;
  const waiters: Waiter[] = [];
  const activeCalls = new Map<number, ActiveCall>();

  const start = (callId: number, name: string): void => {
    active += 1;
    activeCalls.set(callId, { callId, name, startedAtMs: Date.now() });
  };

  const acquire = (name: string, callId: number): Promise<boolean> => {
    if (active < maximum) {
      start(callId, name);
      return Promise.resolve(false);
    }

    const queuedAtMs = Date.now();
    console.debug("[plasmon.neutron] queued frontend tool call", {
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
    console.debug("[plasmon.neutron] admitted queued frontend tool call", {
      callId: next.callId,
      name: next.name,
      waitMs: Date.now() - next.queuedAtMs,
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
      console.debug("[plasmon.neutron] completed queued frontend tool call", {
        callId,
        name: current?.name,
        durationMs: current === undefined ? undefined : Date.now() - current.startedAtMs,
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

export const admitFrontendToolCall = createFrontendCallAdmission();

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
