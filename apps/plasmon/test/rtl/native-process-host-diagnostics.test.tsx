import { expect, test } from "bun:test";
import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import type { FsService, NativeAppDefinition } from "../../src/os/contracts/index.ts";
import { NativeProcessHost } from "../../src/os/process/NativeProcessHost.tsx";
import { NativeProcessController } from "../../src/os/process/controller.ts";
import type { NativeAppComponentProps } from "../../src/os/process/runtime.ts";
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

test("starting processes keep the app unmounted until close-handler registration is valid", async () => {
  const registry = new NativeApplicationRegistry();
  registry.registerWithLoader(app(), async () => {
    const Application = ({ processId, process }: NativeAppComponentProps) => {
      useEffect(() => {
        const unregister = process.registerCloseHandler(processId, () => "allow");
        return unregister;
      }, [process, processId]);
      return <div role="status">Mounted</div>;
    };
    return Application;
  });
  const manager = windows();
  const placement = deferred<void>();
  const process = new NativeProcessController(registry, manager, undefined, {
    onWindowCreated: () => placement.promise,
  });
  const opening = process.open("native:host-diagnostics", {});
  const view = render(
    <NativeProcessHost
      processId="native:host-diagnostics#1"
      registry={registry}
      process={process}
      fs={{} as FsService}
      fallback={<div role="status">Loading…</div>}
      errorFallback={<div role="alert">Application failed to render.</div>}
    />,
  );

  try {
    expect(view.getByRole("status").textContent).toBe("Loading…");
    placement.resolve();
    const processId = await opening;
    expect(processId).toBe("native:host-diagnostics#1");
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Mounted"));
    expect(view.queryByRole("alert")).toBeNull();
    expect(process.close(processId!)).toBe(true);
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
