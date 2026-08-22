import type { FsToolCaller, FsToolName, JsonObject } from "./transport.ts";

export const MAX_CONCURRENT_FS_FRONTEND_CALLS = 8;

type Waiter = () => void;
type ActiveCall = {
  callId: number;
  name: FsToolName;
  startedAtMs: number;
};

/**
 * Keep Plasmon's filesystem fanout inside Kernel's normal frontend-call lane.
 *
 * Filesystem invalidation can wake several mounted consumers at once (Desktop,
 * Explorer, Search, dialogs). Kernel intentionally rejects a ninth concurrent
 * normal tool call from one endpoint, so admission belongs at this shared
 * foreground transport boundary rather than in individual surfaces.
 */
export function withFsToolCallAdmission(
  callTool: FsToolCaller,
  maximum = MAX_CONCURRENT_FS_FRONTEND_CALLS,
): FsToolCaller {
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new Error("Filesystem frontend call concurrency must be a positive integer");
  }

  let active = 0;
  let nextCallId = 0;
  const waiters: Waiter[] = [];
  const activeCalls = new Map<number, ActiveCall>();

  const acquire = async (name: FsToolName, callId: number): Promise<boolean> => {
    const queued = active >= maximum;
    if (queued) {
      console.debug("[plasmon.fs.rpc] queued frontend tool call", {
        callId,
        name,
        active,
        queued: waiters.length + 1,
        maximum,
        activeCalls: [...activeCalls.values()],
      });
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active += 1;
    activeCalls.set(callId, { callId, name, startedAtMs: Date.now() });
    if (queued) {
      console.debug("[plasmon.fs.rpc] admitted queued frontend tool call", {
        callId,
        name,
        active,
        queued: waiters.length,
        maximum,
      });
    }
    return queued;
  };

  const release = (callId: number, queued: boolean): void => {
    const current = activeCalls.get(callId);
    activeCalls.delete(callId);
    active -= 1;
    if (queued) {
      console.debug("[plasmon.fs.rpc] completed queued frontend tool call", {
        callId,
        name: current?.name,
        durationMs: current === undefined ? undefined : Date.now() - current.startedAtMs,
        active,
        queued: waiters.length,
        maximum,
      });
    }
    waiters.shift()?.();
  };

  return async (name: FsToolName, arguments_: JsonObject) => {
    const callId = nextCallId += 1;
    const queued = await acquire(name, callId);
    try {
      return await callTool(name, arguments_);
    } finally {
      release(callId, queued);
    }
  };
}
