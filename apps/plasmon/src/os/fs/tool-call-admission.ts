import type { FsToolCaller, FsToolName, JsonObject } from "./transport.ts";

export const MAX_CONCURRENT_FS_FRONTEND_CALLS = 8;

type Waiter = () => void;

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

  const acquire = async (name: FsToolName, callId: number): Promise<void> => {
    if (active >= maximum) {
      console.debug("[plasmon.fs.rpc] queued frontend tool call", {
        callId,
        name,
        active,
        queued: waiters.length + 1,
        maximum,
      });
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active += 1;
  };

  const release = (): void => {
    active -= 1;
    waiters.shift()?.();
  };

  return async (name: FsToolName, arguments_: JsonObject) => {
    const callId = nextCallId += 1;
    await acquire(name, callId);
    try {
      return await callTool(name, arguments_);
    } finally {
      release();
    }
  };
}
