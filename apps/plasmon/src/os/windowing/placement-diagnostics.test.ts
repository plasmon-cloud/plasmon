import { expect, test } from "bun:test";
import type { WindowGeometry } from "../contracts/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
import { NativeWindowManager } from "./NativeWindowManager.ts";
import {
  FS_WINDOW_PLACEMENTS_METADATA_KEY,
  FsServiceWindowPlacementStore,
  NativeWindowPlacementController,
  type WindowPlacementPersistenceStage,
  type WindowPlacementStore,
} from "./placement.ts";

class DiagnosticPlacementStore implements WindowPlacementStore {
  value: WindowGeometry | null = null;
  failRead = false;
  failWrite = false;

  async get(): Promise<WindowGeometry | null> {
    if (this.failRead) throw new TypeError("private/read/path");
    return this.value ? { ...this.value } : null;
  }

  async set(_key: string, geometry: WindowGeometry): Promise<void> {
    if (this.failWrite) throw new RangeError("private/write/path");
    this.value = { ...geometry };
  }

  async flush(): Promise<void> {}
}

function manager(): NativeWindowManager {
  let ordinal = 0;
  return new NativeWindowManager({
    idFactory: () => `window:test:placement-diagnostics:${++ordinal}`,
    viewport: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    listenForViewportChanges: false,
  });
}

test("malformed persisted placement is rejected without discarding valid sibling records", async () => {
  let uuid = 0;
  const fs = new PersistentFsService(new MemoryFsRepository(), {
    randomUUID: () => `00000000-0000-4000-8000-${(++uuid).toString().padStart(12, "0")}`,
  });
  const root = await fs.resolvePath("/");
  if (!root) throw new Error("filesystem root missing");
  await fs.setMetadata(root.id, {
    [FS_WINDOW_PLACEMENTS_METADATA_KEY]: {
      version: 1,
      placements: {
        broken: { x: "nope", y: 10, width: 400, height: 300 },
        valid: { x: -200, y: 40, width: 640, height: 480 },
      },
    },
  });

  const rejected: string[] = [];
  const store = new FsServiceWindowPlacementStore(fs, undefined, {
    onRestoreRejected: (reason) => rejected.push(reason),
  });
  expect(await store.get("valid")).toEqual({ x: -200, y: 40, width: 640, height: 480 });
  expect(await store.get("broken")).toBeNull();
  expect(rejected).toEqual(["invalid-metadata"]);
});

test("placement read and write failures retain their owning stage", async () => {
  const windows = manager();
  const store = new DiagnosticPlacementStore();
  const failures: Array<{ error: unknown; stage: WindowPlacementPersistenceStage }> = [];
  const placement = new NativeWindowPlacementController(windows, store, {
    onPersistenceError: (error, stage) => failures.push({ error, stage }),
  });
  try {
    store.failRead = true;
    const first = windows.create("process:first", { width: 500, height: 400 });
    await placement.attach("native:first", first);
    expect(failures.map(({ stage }) => stage)).toEqual(["read"]);

    store.failRead = false;
    store.failWrite = true;
    const second = windows.create("process:second", { width: 500, height: 400 });
    await placement.attach("native:second", second);
    windows.move(second, 120, 90);
    await Promise.resolve();
    await Promise.resolve();
    expect(failures.map(({ stage }) => stage)).toEqual(["read", "write"]);
  } finally {
    placement.dispose();
    windows.dispose();
  }
});

test("successful constrained restore remains quiet while accepted geometry is persisted", async () => {
  const windows = manager();
  const store = new DiagnosticPlacementStore();
  store.value = { x: 99_999, y: 99_999, width: 99_999, height: 99_999 };
  const failures: WindowPlacementPersistenceStage[] = [];
  const placement = new NativeWindowPlacementController(windows, store, {
    onPersistenceError: (_error, stage) => failures.push(stage),
  });
  try {
    const id = windows.create("process:test", { width: 500, height: 400 });
    await placement.attach("native:test", id);
    await Promise.resolve();
    expect(failures).toEqual([]);
    expect(store.value).not.toEqual({ x: 99_999, y: 99_999, width: 99_999, height: 99_999 });
  } finally {
    placement.dispose();
    windows.dispose();
  }
});
