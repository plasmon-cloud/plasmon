import {
  nodePocketIcProcessHost,
  type PocketIcProcessExit,
  type PocketIcProcessHost,
} from "./pocketic_supervisor.ts";

export type PocketIcProcessDiagnosticLogger = Pick<Console, "error">;

function exitDetail(exit: PocketIcProcessExit): string {
  return `code=${String(exit.code)} signal=${String(exit.signal)}`;
}

/**
 * Preserve the real child-process termination result for the long-lived local
 * supervisor. Startup already observes `LaunchedPocketIcProcess.exited`, but
 * after readiness the supervisor's health loop can only report that the PID or
 * start identity disappeared. Logging this owner-only exit promise gives a
 * failed packaged run the code/signal needed to distinguish a PocketIC exit,
 * external signal, and runner-level kill without changing runtime behavior.
 */
export function withPocketIcProcessDiagnostics(
  delegate: PocketIcProcessHost = nodePocketIcProcessHost,
  logger: PocketIcProcessDiagnosticLogger = console,
): PocketIcProcessHost {
  return {
    async launch(command, args) {
      const launched = await delegate.launch(command, args);
      void launched.exited.then(
        (exit) => {
          logger.error(
            `[pocketic-supervisor] child pid=${launched.pid} exited ${exitDetail(exit)}`,
          );
        },
        (error: unknown) => {
          logger.error(
            `[pocketic-supervisor] child pid=${launched.pid} exit observation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      );
      return launched;
    },
    processIdentity: (pid) => delegate.processIdentity(pid),
    terminate: (pid) => delegate.terminate(pid),
  };
}

export const diagnosticPocketIcProcessHost = withPocketIcProcessDiagnostics();
