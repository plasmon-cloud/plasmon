import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { PlasmonOS } from "../../src/os/PlasmonOS.tsx";
import type { NativeAppDefinition } from "../../src/os/contracts/index.ts";
import { installRuntimeDiagnosticCapture } from "../../src/os/diagnostics/runtimeCapture.ts";
import { observeDiagnostics } from "../diagnosticObserver.ts";
import { createHeadlessPlasmonEnvironment } from "../headlessEnvironment.ts";

const APP_ID = "native:contained-runtime-capture";

function app(): NativeAppDefinition {
  return {
    id: APP_ID,
    handlerId: APP_ID,
    name: "Contained runtime capture",
    icon: "system:test",
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

test("a contained native-host crash remains host-owned and is not reported again globally", async () => {
  const env = createHeadlessPlasmonEnvironment();
  const observed = observeDiagnostics(env.diagnostics);
  const capture = installRuntimeDiagnosticCapture(env.diagnostics, window);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container, {
    onUncaughtError: capture.onReactUncaughtError,
  });

  try {
    await env.ready;
    const failure = new TypeError("private contained render detail");
    env.services.nativeApps.registerWithLoader(app(), async () => {
      const Crash = () => { throw failure; };
      return Crash;
    });

    await act(async () => {
      root.render(<PlasmonOS services={env.services} />);
    });
    await act(async () => {
      const processId = await env.services.process.open(APP_ID, {});
      if (!processId) throw new Error("contained native process did not start");
    });

    await waitFor(() => {
      expect(container.querySelector('[role="alert"]')?.textContent)
        .toContain("Application failed to render");
    });
    await observed.settle();

    expect(observed.records({
      subsystem: "native-app",
      event: "native-app.crashed",
      level: "error",
    })).toHaveLength(1);
    expect(observed.records({
      subsystem: "runtime",
      event: "runtime.uncaught_error",
      level: "error",
    })).toHaveLength(0);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    capture.dispose();
    observed.dispose();
    env.dispose();
  }
});
