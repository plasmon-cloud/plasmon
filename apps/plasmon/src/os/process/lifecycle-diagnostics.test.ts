import { expect, test } from "bun:test";
import type {
  NativeAppDefinition,
  ProcessId,
  ProcessRecord,
  WindowCreateOptions,
  WindowFocusSnapshot,
  WindowId,
  WindowManager,
  WindowState,
} from "../contracts/index.ts";
import { NativeProcessController, type NativeProcessStartupStage } from "./controller.ts";
import { NativeApplicationRegistry } from "./registry.ts";

function app(): NativeAppDefinition {
  return {
    id: "native:test",
    handlerId: "native:test",
    name: "Test",
    icon: "system:test",
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

class LifecycleWindowManager implements WindowManager {
  private windows: WindowState[] = [];
  private readonly listeners = new Set<() => void>();
  failCreate = false;
  failClose = false;
  nextId = 1;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  create(processId: ProcessId, initial: WindowCreateOptions): WindowId {
    if (this.failCreate) throw new Error("window create failed");
    const id = `window:${this.nextId++}`;
    this.windows.push({
      id,
      processId,
      x: initial.x ?? 0,
      y: initial.y ?? 0,
      width: initial.width ?? 640,
      height: initial.height ?? 480,
      z: this.nextId,
      minimized: false,
      maximized: false,
    });
    this.emit();
    return id;
  }

  focus(): void {}
  focusSnapshot(): WindowFocusSnapshot { return { focusedId: null, mru: [] }; }
  move(): void {}
  resize(): void {}
  minimize(): void {}
  maximize(): void {}
  restore(): void {}

  close(id: WindowId): void {
    if (this.failClose) throw new Error("window close failed");
    this.windows = this.windows.filter((window) => window.id !== id);
    this.emit();
  }

  closeExternally(id: WindowId): void {
    this.windows = this.windows.filter((window) => window.id !== id);
    this.emit();
  }

  list(): readonly WindowState[] {
    return this.windows.map((window) => ({ ...window }));
  }
}

test("startup failures identify window creation versus post-create placement", async () => {
  const registry = new NativeApplicationRegistry();
  registry.register(app());
  const windows = new LifecycleWindowManager();
  const failures: Array<{ stage: NativeProcessStartupStage; processId: ProcessId }> = [];
  let failPlacement = false;
  const controller = new NativeProcessController(registry, windows, undefined, {
    onWindowCreated: async () => {
      if (failPlacement) throw new Error("placement failed");
    },
    onStartupError: (_error, _app, _target, stage, processId) => {
      failures.push({ stage, processId });
    },
  });

  windows.failCreate = true;
  expect(await controller.open("native:test", {})).toBeNull();
  expect(failures[0]).toEqual({ stage: "window-create", processId: "native:test#1" });
  expect(controller.list()).toEqual([]);

  windows.failCreate = false;
  failPlacement = true;
  expect(await controller.open("native:test", {})).toBeNull();
  expect(failures[1]).toEqual({ stage: "window-placement", processId: "native:test#2" });
  expect(windows.list()).toEqual([]);
  expect(controller.list()).toEqual([]);
  controller.dispose();
});

test("close-handler failure, window teardown failure, and external window loss are distinct", async () => {
  const registry = new NativeApplicationRegistry();
  registry.register(app());
  const windows = new LifecycleWindowManager();
  const handlerFailures: ProcessRecord[] = [];
  const teardownFailures: ProcessRecord[] = [];
  const lost: ProcessRecord[] = [];
  const controller = new NativeProcessController(registry, windows, undefined, {
    onCloseError: (_error, record) => handlerFailures.push(record),
    onWindowCloseError: (_error, record) => teardownFailures.push(record),
    onWindowLost: (record) => lost.push(record),
  });

  const first = await controller.open("native:test", {});
  if (!first) throw new Error("first process did not start");
  const unregister = controller.registerCloseHandler(first, () => {
    throw new Error("close handler failed");
  });
  expect(controller.close(first)).toBe(false);
  expect(handlerFailures.map((record) => record.id)).toEqual([first]);
  expect(teardownFailures).toEqual([]);
  expect(lost).toEqual([]);

  unregister();
  windows.failClose = true;
  expect(() => controller.close(first)).toThrow("window close failed");
  expect(teardownFailures.map((record) => record.id)).toEqual([first]);
  expect(controller.list()).toEqual([]);
  expect(lost).toEqual([]);

  windows.failClose = false;
  const second = await controller.open("native:test", {});
  if (!second) throw new Error("second process did not start");
  const windowId = controller.list().find((record) => record.id === second)?.windowId;
  if (!windowId) throw new Error("second process has no window");
  windows.closeExternally(windowId);
  expect(lost.map((record) => record.id)).toEqual([second]);
  expect(controller.list()).toEqual([]);

  const third = await controller.open("native:test", {});
  if (!third) throw new Error("third process did not start");
  expect(controller.close(third)).toBe(true);
  expect(lost.map((record) => record.id)).toEqual([second]);
  controller.dispose();
});
