import { expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import type { FsService, NativeAppDefinition } from "../../src/os/contracts/index.ts";
import { NativeProcessHost } from "../../src/os/process/NativeProcessHost.tsx";
import { NativeProcessController } from "../../src/os/process/controller.ts";
import { NativeApplicationRegistry } from "../../src/os/process/registry.ts";
import { NativeWindowManager } from "../../src/os/windowing/NativeWindowManager.ts";

function app(): NativeAppDefinition {
  return {
    id: "native:host-diagnostics",
    handlerId: "native:host-diagnostics",
    name: "Host diagnostics",
    icon: "system:test",
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

function windows(): NativeWindowManager {
  let ordinal = 0;
  return new NativeWindowManager({
    idFactory: () => `window:host-diagnostics:${++ordinal}`,
    listenForViewportChanges: false,
  });
}

test("missing native loader preserves the fallback and reports the host gap once", async () => {
  const registry = new NativeApplicationRegistry();
  registry.register(app());
  const manager = windows();
  const process = new NativeProcessController(registry, manager);
  const processId = await process.open("native:host-diagnostics", {});
  if (!processId) throw new Error("process did not start");
  const missing: string[] = [];
  const view = render(
    <NativeProcessHost
      processId={processId}
      registry={registry}
      process={process}
      fs={{} as FsService}
      missingFallback={<div role="alert">Application host is unavailable.</div>}
      onMissingLoader={(appId) => missing.push(appId)}
    />,
  );

  try {
    expect(view.getByRole("alert").textContent).toBe("Application host is unavailable.");
    await waitFor(() => expect(missing).toEqual(["native:host-diagnostics"]));
    view.rerender(
      <NativeProcessHost
        processId={processId}
        registry={registry}
        process={process}
        fs={{} as FsService}
        missingFallback={<div role="alert">Application host is unavailable.</div>}
        onMissingLoader={(appId) => missing.push(appId)}
      />,
    );
    await Promise.resolve();
    expect(missing).toEqual(["native:host-diagnostics"]);
  } finally {
    view.unmount();
    process.dispose();
    manager.dispose();
  }
});

test("contained application render crashes reach the generic host boundary and keep the visible fallback", async () => {
  const registry = new NativeApplicationRegistry();
  const failure = new TypeError("private render failure details");
  registry.registerWithLoader(app(), async () => {
    const Crash = () => { throw failure; };
    return Crash;
  });
  const manager = windows();
  const process = new NativeProcessController(registry, manager);
  const processId = await process.open("native:host-diagnostics", {});
  if (!processId) throw new Error("process did not start");
  const errors: unknown[] = [];
  const view = render(
    <NativeProcessHost
      processId={processId}
      registry={registry}
      process={process}
      fs={{} as FsService}
      fallback={<div role="status">Loading…</div>}
      errorFallback={<div role="alert">Application failed to render.</div>}
      onError={(error) => errors.push(error)}
    />,
  );

  try {
    await waitFor(() => expect(view.getByRole("alert").textContent).toBe("Application failed to render."));
    await waitFor(() => expect(errors).toEqual([failure]));
    expect(registry.isLoadFailure("native:host-diagnostics", failure)).toBe(false);
  } finally {
    view.unmount();
    process.dispose();
    manager.dispose();
  }
});

test("lazy loader rejection is identifiable so production crash wiring can avoid a duplicate incident", async () => {
  const registry = new NativeApplicationRegistry();
  const failure = new RangeError("private loader failure details");
  registry.registerWithLoader(app(), async () => { throw failure; });
  const manager = windows();
  const process = new NativeProcessController(registry, manager);
  const processId = await process.open("native:host-diagnostics", {});
  if (!processId) throw new Error("process did not start");
  const errors: unknown[] = [];
  const view = render(
    <NativeProcessHost
      processId={processId}
      registry={registry}
      process={process}
      fs={{} as FsService}
      errorFallback={<div role="alert">Application failed to render.</div>}
      onError={(error) => errors.push(error)}
    />,
  );

  try {
    await waitFor(() => expect(errors).toEqual([failure]));
    expect(registry.isLoadFailure("native:host-diagnostics", errors[0])).toBe(true);
  } finally {
    view.unmount();
    process.dispose();
    manager.dispose();
  }
});
