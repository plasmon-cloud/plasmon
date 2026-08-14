import { expect, test } from "bun:test";
import type { WindowGeometry } from "../contracts/window.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
import { NativeWindowManager } from "./NativeWindowManager.ts";
import {
  FS_WINDOW_PLACEMENTS_METADATA_KEY,
  FsServiceWindowPlacementStore,
  NativeWindowPlacementController,
  type WindowPlacementStore,
} from "./placement.ts";

class MemoryPlacementStore implements WindowPlacementStore {
  value: WindowGeometry | null;
  writes: WindowGeometry[] = [];

  constructor(value: WindowGeometry | null = null) {
    this.value = value ? { ...value } : null;
  }

  async get(): Promise<WindowGeometry | null> {
    return this.value ? { ...this.value } : null;
  }

  async set(_key: string, geometry: WindowGeometry): Promise<void> {
    this.value = { ...geometry };
    this.writes.push({ ...geometry });
  }

  async flush(): Promise<void> {}
}

function manager(): NativeWindowManager {
  return new NativeWindowManager({
    idFactory: () => "window:test:placement",
    viewport: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    listenForViewportChanges: false,
  });
}

test("restored persisted geometry is validated and normalized by WindowManager", async () => {
  const windows = manager();
  const store = new MemoryPlacementStore({ x: 99_999, y: 99_999, width: 99_999, height: 99_999 });
  const placement = new NativeWindowPlacementController(windows, store);
  try {
    const id = windows.create("process:test", { width: 500, height: 400 });
    await placement.attach("native:test", id);
    await placement.flush();

    expect(windows.get(id)).toMatchObject({
      x: 728,
      y: 568,
      width: 800,
      height: 600,
    });
    expect(store.value).toEqual({ x: 728, y: 568, width: 800, height: 600 });
  } finally {
    placement.dispose();
    windows.dispose();
  }
});

test("snap and maximize presentation persist the normal/restorable rectangle", async () => {
  const windows = manager();
  const store = new MemoryPlacementStore();
  const placement = new NativeWindowPlacementController(windows, store);
  try {
    const id = windows.create("process:test", { width: 500, height: 400 });
    await placement.attach("native:test", id);

    windows.move(id, 210, 130);
    windows.resize(id, 540, 420);
    await placement.flush();
    const normal = { x: 210, y: 130, width: 540, height: 420 };
    expect(store.value).toEqual(normal);

    windows.maximize(id);
    await placement.flush();
    expect(store.value).toEqual(normal);

    windows.restore(id);
    windows.snap(id, "left", normal);
    await placement.flush();
    expect(store.value).toEqual(normal);
  } finally {
    placement.dispose();
    windows.dispose();
  }
});

test("filesystem placement store ignores corrupt entries without weakening other records", async () => {
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

  const store = new FsServiceWindowPlacementStore(fs);
  expect(await store.get("broken")).toBeNull();
  expect(await store.get("valid")).toEqual({ x: -200, y: 40, width: 640, height: 480 });
});
