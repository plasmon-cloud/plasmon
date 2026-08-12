import { describe, expect, test } from "bun:test";
import type {
  JsonValue,
  NativeAppDefinition,
  OpenTarget,
  ProcessCloseRequest,
  ProcessId,
  WindowCreateOptions,
  WindowId,
  WindowManager,
  WindowState,
} from "../contracts/index.ts";
import { NativeProcessController } from "./controller.ts";
import { NativeApplicationRegistry } from "./registry.ts";

function app(overrides: Partial<NativeAppDefinition> = {}): NativeAppDefinition {
  return {
    id: "native:text",
    handlerId: "native:text",
    name: "Text Editor",
    icon: "system:text",
    defaultWindow: { width: 760, height: 560, minWidth: 420, minHeight: 280 },
    associations: [],
    ...overrides,
  };
}

class TestWindowManager implements WindowManager {
  private windows: WindowState[] = [];
  private readonly listeners = new Set<() => void>();
  readonly calls: Array<readonly [string, ...unknown[]]> = [];
  failCreate = false;
  private nextId = 1;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  create(processId: ProcessId, initial: WindowCreateOptions): WindowId {
    this.calls.push(["create", processId, { ...initial }]);
    if (this.failCreate) throw new Error("window startup failed");
    const id = `window:${this.nextId++}`;
    this.windows.push({
      id,
      processId,
      x: initial.x ?? 0,
      y: initial.y ?? 0,
      width: initial.width ?? 640,
      height: initial.height ?? 480,
      z: this.windows.length + 1,
      minimized: false,
      maximized: false,
      ...(initial.minWidth !== undefined ? { minWidth: initial.minWidth } : {}),
      ...(initial.minHeight !== undefined ? { minHeight: initial.minHeight } : {}),
    });
    this.emit();
    return id;
  }

  focus(id: WindowId): void {
    this.calls.push(["focus", id]);
  }

  move(): void {}
  resize(): void {}
  minimize(): void {}
  maximize(): void {}
  restore(): void {}

  close(id: WindowId): void {
    this.calls.push(["close", id]);
    this.windows = this.windows.filter((window) => window.id !== id);
    this.emit();
  }

  list(): readonly WindowState[] {
    return this.windows.map((window) => ({ ...window }));
  }

  closeExternally(id: WindowId): void {
    this.windows = this.windows.filter((window) => window.id !== id);
    this.emit();
  }
}

function setup(definition: NativeAppDefinition = app()) {
  const registry = new NativeApplicationRegistry();
  registry.register(definition);
  const windows = new TestWindowManager();
  const controller = new NativeProcessController(registry, windows);
  return { registry, windows, controller };
}

describe("NativeProcessController", () => {
  test("creates a running process and passes default window constraints", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", { nodeId: "node:1" });

    expect(id).toBe("native:text#1");
    expect(controller.list()).toEqual([
      expect.objectContaining({
        id,
        appId: "native:text",
        handlerId: "native:text",
        target: { nodeId: "node:1" },
        title: "Text Editor",
        icon: "system:text",
        state: "running",
        windowId: "window:1",
      }),
    ]);
    expect(windows.calls[0]).toEqual([
      "create",
      id,
      { width: 760, height: 560, minWidth: 420, minHeight: 280 },
    ]);
  });

  test("caller mutations cannot change stored nested Atom metadata", async () => {
    const { controller } = setup();
    const nestedObject = { value: "original" };
    const arrayObject = { value: "array-original" };
    const items: JsonValue[] = ["first", arrayObject];
    const target: OpenTarget = {
      atom: {
        format: "plasmon.atom",
        version: 1,
        atomId: "atom:1",
        handlerId: "native:text",
        atomType: "text",
        schemaVersion: 1,
        metadata: {
          nested: nestedObject,
          items,
        },
      },
    };

    await controller.open("native:text", target);
    nestedObject.value = "caller-mutated";
    arrayObject.value = "caller-array-mutated";
    items.push("caller-added");

    expect(controller.list()[0]?.target.atom?.metadata).toEqual({
      nested: { value: "original" },
      items: ["first", { value: "array-original" }],
    });
  });

  test("list snapshots cannot mutate stored nested Atom metadata", async () => {
    const { controller } = setup();
    await controller.open("native:text", {
      atom: {
        format: "plasmon.atom",
        version: 1,
        atomId: "atom:1",
        handlerId: "native:text",
        atomType: "text",
        schemaVersion: 1,
        metadata: {
          nested: { value: "original" },
          items: ["first", { value: "array-original" }],
        },
      },
    });

    const metadata = controller.list()[0]?.target.atom?.metadata;
    if (!metadata) throw new Error("expected Atom metadata");

    const nested = metadata.nested;
    if (nested === null || Array.isArray(nested) || typeof nested !== "object") {
      throw new Error("expected nested object metadata");
    }
    nested.value = "list-mutated";

    const items = metadata.items;
    if (!Array.isArray(items)) throw new Error("expected nested array metadata");
    const arrayObject = items[1];
    if (arrayObject === null || Array.isArray(arrayObject) || typeof arrayObject !== "object") {
      throw new Error("expected object inside metadata array");
    }
    arrayObject.value = "list-array-mutated";
    items.push("list-added");

    expect(controller.list()[0]?.target.atom?.metadata).toEqual({
      nested: { value: "original" },
      items: ["first", { value: "array-original" }],
    });
  });

  test("singleton open reuses process, updates target, and focuses", async () => {
    const { controller, windows } = setup(app({ singleton: true }));
    const first = await controller.open("native:text", { nodeId: "node:1" });
    const second = await controller.open("native:text", { nodeId: "node:2" });

    expect(second).toBe(first);
    expect(controller.list()).toHaveLength(1);
    expect(controller.list()[0]?.target).toEqual({ nodeId: "node:2" });
    expect(windows.calls.filter(([kind]) => kind === "create")).toHaveLength(1);
    expect(windows.calls.at(-1)).toEqual(["focus", "window:1"]);
  });

  test("multi-instance app receives distinct monotonic process IDs", async () => {
    const { controller } = setup();
    const first = await controller.open("native:text", { nodeId: "node:1" });
    const second = await controller.open("native:text", { nodeId: "node:2" });

    expect([first, second]).toEqual(["native:text#1", "native:text#2"]);
    expect(controller.list().map((record) => record.target.nodeId)).toEqual([
      "node:1",
      "node:2",
    ]);
  });

  test("close without a registered concern removes process and window immediately", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");

    expect(controller.close(id)).toBe(true);
    expect(controller.list()).toEqual([]);
    expect(windows.list()).toEqual([]);
    expect(windows.calls.at(-1)).toEqual(["close", "window:1"]);
  });

  test("ordinary close handler can allow immediate teardown", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");
    let calls = 0;
    controller.registerCloseHandler(id, () => {
      calls += 1;
      return "allow";
    });

    expect(controller.close(id)).toBe(true);
    expect(calls).toBe(1);
    expect(controller.list()).toEqual([]);
    expect(windows.list()).toEqual([]);
  });

  test("ordinary close handler can prevent teardown", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");
    let calls = 0;
    const unregister = controller.registerCloseHandler(id, () => {
      calls += 1;
      return "prevent";
    });

    expect(controller.close(id)).toBe(false);
    expect(calls).toBe(1);
    expect(controller.list()).toHaveLength(1);
    expect(controller.list()[0]?.state).toBe("running");
    expect(windows.list()).toHaveLength(1);

    unregister();
    expect(controller.close(id)).toBe(true);
  });

  test("window-originated ordinary close can defer and later complete the same lifecycle request", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");
    let calls = 0;
    let pending: ProcessCloseRequest | null = null;
    controller.registerCloseHandler(id, (request) => {
      calls += 1;
      pending = request;
      return "defer";
    });

    const requestWindowClose = (_windowId: WindowId, processId: ProcessId): boolean =>
      controller.close(processId);

    expect(requestWindowClose("window:1", id)).toBe(false);
    expect(controller.list()[0]?.state).toBe("running");
    expect(windows.list()).toHaveLength(1);
    expect(controller.close(id)).toBe(false);
    expect(calls).toBe(1);

    if (!pending) throw new Error("expected deferred close request");
    pending.complete();
    expect(controller.list()).toEqual([]);
    expect(windows.list()).toEqual([]);
  });

  test("canceling a deferred close keeps the process alive and permits a later close request", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");
    const requests: ProcessCloseRequest[] = [];
    controller.registerCloseHandler(id, (request) => {
      requests.push(request);
      return "defer";
    });

    expect(controller.close(id)).toBe(false);
    expect(requests).toHaveLength(1);
    requests[0]?.cancel();
    expect(controller.list()).toHaveLength(1);
    expect(windows.list()).toHaveLength(1);

    expect(controller.close(id)).toBe(false);
    expect(requests).toHaveLength(2);
    requests[1]?.complete();
    expect(controller.list()).toEqual([]);
    expect(windows.list()).toEqual([]);
  });

  test("forceClose explicitly bypasses a deferred ordinary close", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");
    let pending: ProcessCloseRequest | null = null;
    controller.registerCloseHandler(id, (request) => {
      pending = request;
      return "defer";
    });

    expect(controller.close(id)).toBe(false);
    expect(controller.forceClose(id)).toBe(true);
    expect(controller.list()).toEqual([]);
    expect(windows.list()).toEqual([]);

    pending?.complete();
    expect(controller.list()).toEqual([]);
  });

  test("external WindowManager closure removes the running process", async () => {
    const { controller, windows } = setup();
    await controller.open("native:text", {});
    windows.closeExternally("window:1");
    expect(controller.list()).toEqual([]);
  });

  test("title and target changes notify subscribers", async () => {
    const { controller } = setup();
    const id = await controller.open("native:text", { nodeId: "node:1" });
    if (!id) throw new Error("expected process startup");
    let notifications = 0;
    const unsubscribe = controller.subscribe(() => notifications++);

    controller.setTitle(id, "notes.txt");
    controller.setTarget(id, { nodeId: "node:2", readOnly: true });

    expect(notifications).toBe(2);
    expect(controller.list()[0]).toEqual(
      expect.objectContaining({
        title: "notes.txt",
        target: { nodeId: "node:2", readOnly: true },
      }),
    );
    unsubscribe();
    controller.setTitle(id, "ignored notification");
    expect(notifications).toBe(2);
  });

  test("focus delegates through the WindowManager contract", async () => {
    const { controller, windows } = setup();
    const id = await controller.open("native:text", {});
    if (!id) throw new Error("expected process startup");
    controller.focus(id);
    expect(windows.calls.at(-1)).toEqual(["focus", "window:1"]);
  });

  test("unknown handlers and failed window startup do not leave process records", async () => {
    const { controller, windows } = setup();
    expect(await controller.open("native:missing", {})).toBeNull();

    windows.failCreate = true;
    expect(await controller.open("native:text", { nodeId: "node:1" })).toBeNull();
    expect(controller.list()).toEqual([]);
  });
});

describe("NativeApplicationRegistry lazy loader", () => {
  test("loads once after success and retries after a rejection", async () => {
    const registry = new NativeApplicationRegistry();
    registry.register(app());

    let attempts = 0;
    const Component = () => null;
    registry.setLoader("native:text", async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary loader failure");
      return { default: Component };
    });

    await expect(registry.loadComponent("native:text")).rejects.toThrow(
      "temporary loader failure",
    );
    expect(await registry.loadComponent("native:text")).toBe(Component);
    expect(await registry.loadComponent("native:text")).toBe(Component);
    expect(attempts).toBe(2);
  });

  test("keeps public metadata defensive and React-independent", () => {
    const registry = new NativeApplicationRegistry();
    registry.register(app());
    const fetched = registry.get("native:text");
    if (!fetched) throw new Error("expected registered app");
    fetched.defaultWindow.width = 1;

    expect(registry.get("native:text")?.defaultWindow.width).toBe(760);
    expect("Component" in (registry.get("native:text") ?? {})).toBe(false);
  });
});
