import { expect, test } from "bun:test";
import { withPocketIcProcessDiagnostics } from "../src/pocketic_process_diagnostics.ts";
import type {
  LaunchedPocketIcProcess,
  PocketIcProcessExit,
  PocketIcProcessHost,
} from "../src/pocketic_supervisor.ts";

function deferredExit(): {
  launched: LaunchedPocketIcProcess;
  resolve: (exit: PocketIcProcessExit) => void;
} {
  let resolve!: (exit: PocketIcProcessExit) => void;
  const exited = new Promise<PocketIcProcessExit>((settle) => { resolve = settle; });
  return { launched: { pid: 4242, exited }, resolve };
}

test("process diagnostics retain the owned child exit code and signal", async () => {
  const exit = deferredExit();
  const errors: string[] = [];
  const delegate: PocketIcProcessHost = {
    async launch() { return exit.launched; },
    async processIdentity(pid) { return `linux:${pid}:1`; },
    async terminate() {},
  };
  const host = withPocketIcProcessDiagnostics(delegate, {
    error(message?: unknown) { errors.push(String(message)); },
  });

  const launched = await host.launch("/absolute/pocket-ic", ["--port-file", "/tmp/port"]);
  expect(launched).toBe(exit.launched);
  expect(errors).toEqual([]);

  exit.resolve({ code: null, signal: "SIGKILL" });
  await launched.exited;
  await Promise.resolve();
  expect(errors).toEqual([
    "[pocketic-supervisor] child pid=4242 exited code=null signal=SIGKILL",
  ]);
});

test("process diagnostics preserve identity and termination delegation", async () => {
  const seen: string[] = [];
  const exit = deferredExit();
  const delegate: PocketIcProcessHost = {
    async launch(command, args) {
      seen.push(`launch:${command}:${args.join(",")}`);
      return exit.launched;
    },
    async processIdentity(pid) {
      seen.push(`identity:${pid}`);
      return "identity";
    },
    async terminate(pid) { seen.push(`terminate:${pid}`); },
  };
  const host = withPocketIcProcessDiagnostics(delegate, { error() {} });

  await host.launch("/absolute/pocket-ic", ["--ttl", "1"]);
  expect(await host.processIdentity(7)).toBe("identity");
  await host.terminate(7);
  expect(seen).toEqual([
    "launch:/absolute/pocket-ic:--ttl,1",
    "identity:7",
    "terminate:7",
  ]);
});
