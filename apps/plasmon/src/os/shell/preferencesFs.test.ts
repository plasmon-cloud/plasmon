// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  FsEvent,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  JsonValue,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import {
  DEFAULT_SHELL_PREFERENCES,
  effectiveShellWallpaper,
  SHELL_PREFERENCES_KEY,
  ShellPreferencesController,
  ShellPreferenceStore,
  saveShellPreferencesNonDestructive,
  type ShellPreferences,
} from "./preferences.ts";

class PreferenceFs implements FsService {
  readonly listeners = new Set<(event: FsEvent) => void>();
  readonly root: FsNode = {
    id: "root",
    parentId: null,
    name: "",
    kind: "directory",
    size: 0,
    createdAt: 0,
    modifiedAt: 0,
    metadata: {},
  };
  resolveCalls = 0;
  metadataWrites = 0;
  failWrites = false;

  async stat(id: NodeId): Promise<FsNode> {
    if (id !== this.root.id) throw new Error(`missing node ${id}`);
    return this.snapshot();
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    this.resolveCalls += 1;
    return path === "/" ? this.snapshot() : null;
  }

  async pathOf(id: NodeId): Promise<string> {
    if (id !== this.root.id) throw new Error(`missing node ${id}`);
    return "/";
  }

  async list(_parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> { return []; }
  async mkdir(): Promise<FsNode> { throw new Error("unused"); }
  async createFile(_parentId: NodeId, _name: string, _options?: CreateFileOptions): Promise<FsNode> { throw new Error("unused"); }
  async read(_id: NodeId, _range?: FsReadRange): Promise<Uint8Array> { throw new Error("unused"); }
  async write(_id: NodeId, _bytes: Uint8Array, _options?: WriteOptions): Promise<FsNode> { throw new Error("unused"); }
  async rename(): Promise<FsNode> { throw new Error("unused"); }
  async move(): Promise<FsNode> { throw new Error("unused"); }
  async copy(): Promise<FsNode> { throw new Error("unused"); }
  async remove(): Promise<void> { throw new Error("unused"); }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    if (id !== this.root.id) throw new Error(`missing node ${id}`);
    if (this.failWrites) throw new Error("background write unavailable");
    this.metadataWrites += 1;
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete this.root.metadata[key];
      else this.root.metadata[key] = value;
    }
    const changed = this.snapshot();
    for (const listener of this.listeners) listener({ type: "changed", node: changed });
    return changed;
  }

  async revision(): Promise<Revision> { return 0n; }

  subscribe(listener: (event: FsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private snapshot(): FsNode {
    return { ...this.root, metadata: structuredClone(this.root.metadata) };
  }
}

function preferences(patch: Partial<ShellPreferences> = {}): ShellPreferences {
  return {
    version: 1,
    pinnedNative: [],
    pinnedElements: [],
    themeId: "plasmon-graphite",
    appearanceMode: "dark",
    wallpaper: { mode: "follow-theme" },
    wallpaperLayout: "fill",
    showBrandWatermark: true,
    taskbarAlignment: "center",
    ...patch,
  };
}

test("fresh Shell preferences are Graphite Dark with Rosewood Bloom pinned", async () => {
  const fs = new PreferenceFs();
  const loaded = await new ShellPreferenceStore(fs).load();
  expect(loaded).toEqual(DEFAULT_SHELL_PREFERENCES);
  expect(loaded.themeId).toBe("plasmon-graphite");
  expect(loaded.appearanceMode).toBe("dark");
  expect(loaded.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
  expect(loaded.wallpaperLayout).toBe("fill");
  expect(effectiveShellWallpaper(loaded.themeId, loaded.wallpaper)).toBe("rosewood-bloom");
  expect(fs.metadataWrites).toBe(0);
});

test("legacy v1 Shell preferences preserve existing values and migrate appearance and layout defaults", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-midnight",
    wallpaper: "plain",
  };

  expect(await new ShellPreferenceStore(fs).load()).toEqual(preferences({
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-midnight",
  }));
  expect(fs.metadataWrites).toBe(0);
});

test("existing valid Follow-theme users are not rewritten to the new fresh wallpaper", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = preferences({
    themeId: "plasmon-graphite",
    wallpaper: { mode: "follow-theme" },
  }) as unknown as JsonValue;

  const loaded = await new ShellPreferenceStore(fs).load();
  expect(loaded.wallpaper).toEqual({ mode: "follow-theme" });
  expect(effectiveShellWallpaper(loaded.themeId, loaded.wallpaper)).toBe("graphite-sand");
  expect(fs.metadataWrites).toBe(0);
});

test("preview Plasmon Dark and Aurora values migrate to Verdant and Plasmon Lattice", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: [],
    themeId: "plasmon-dark",
    wallpaper: { mode: "pinned", id: "plasmon-aurora" },
    taskbarAlignment: "center",
  };

  const loaded = await new ShellPreferenceStore(fs).load();
  expect(loaded.themeId).toBe("plasmon-verdant");
  expect(loaded.appearanceMode).toBe("dark");
  expect(loaded.wallpaper).toEqual({ mode: "pinned", id: "plasmon-lattice" });
  expect(loaded.wallpaperLayout).toBe("fill");
  expect(loaded.showBrandWatermark).toBe(true);
});

test("preview Digital Dusk selection migrates to Graphite Sand", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: [],
    pinnedElements: [],
    themeId: "plasmon-graphite",
    wallpaper: { mode: "pinned", id: "digital-dusk" },
  };
  expect((await new ShellPreferenceStore(fs).load()).wallpaper)
    .toEqual({ mode: "pinned", id: "graphite-sand" });
});

test("pinned native application persists through a new ShellPreferenceStore session", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ pinnedNative: ["native:text"] }));
  expect((await new ShellPreferenceStore(fs).load()).pinnedNative).toEqual(["native:text"]);
});

test("pinned Element persists through a new ShellPreferenceStore session", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ pinnedElements: ["mail"] }));
  expect((await new ShellPreferenceStore(fs).load()).pinnedElements).toEqual(["mail"]);
});

test("theme persists through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ themeId: "plasmon-midnight" }));
  expect((await new ShellPreferenceStore(fs).load()).themeId).toBe("plasmon-midnight");
});

test("appearance mode persists through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ appearanceMode: "light" }));
  const loaded = await new ShellPreferenceStore(fs).load();
  expect(loaded.appearanceMode).toBe("light");
  expect(fs.root.metadata[SHELL_PREFERENCES_KEY]).toEqual(preferences({ appearanceMode: "light" }));
});

test("appearance-only controller saves preserve theme wallpaper target and layout", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = preferences({
    themeId: "plasmon-midnight",
    wallpaper: { mode: "filesystem", nodeId: "image-node" },
    wallpaperLayout: "fit",
  }) as unknown as JsonValue;
  const controller = new ShellPreferencesController(new ShellPreferenceStore(fs));
  const before = await controller.load();

  const outcome = await controller.save({ ...before, appearanceMode: "light" });
  expect(outcome.saved).toBe(true);
  expect(outcome.preferences.themeId).toBe("plasmon-midnight");
  expect(outcome.preferences.appearanceMode).toBe("light");
  expect(outcome.preferences.wallpaper).toEqual({ mode: "filesystem", nodeId: "image-node" });
  expect(outcome.preferences.wallpaperLayout).toBe("fit");
});

test("pinned generated wallpaper persists through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ wallpaper: { mode: "pinned", id: "ember-horizon" } }));
  expect((await new ShellPreferenceStore(fs).load()).wallpaper).toEqual({ mode: "pinned", id: "ember-horizon" });
});

test("pinned Graphite Sand JPG wallpaper persists through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ wallpaper: { mode: "pinned", id: "graphite-sand" } }));
  expect((await new ShellPreferenceStore(fs).load()).wallpaper).toEqual({ mode: "pinned", id: "graphite-sand" });
});

test("filesystem wallpaper NodeId and layout persist independently through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  const selected = preferences({
    themeId: "plasmon-rosewood",
    appearanceMode: "light",
    wallpaper: { mode: "filesystem", nodeId: "node-42" },
    wallpaperLayout: "tile",
  });
  await new ShellPreferenceStore(fs).save(selected);
  const loaded = await new ShellPreferenceStore(fs).load();
  expect(loaded).toEqual(selected);
  expect(loaded.wallpaper).toEqual({ mode: "filesystem", nodeId: "node-42" });
  expect(loaded.wallpaperLayout).toBe("tile");
  expect(loaded.themeId).toBe("plasmon-rosewood");
  expect(loaded.appearanceMode).toBe("light");
});

test("Plasmon watermark visibility persists through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ showBrandWatermark: false }));
  expect((await new ShellPreferenceStore(fs).load()).showBrandWatermark).toBe(false);
  expect(fs.root.metadata[SHELL_PREFERENCES_KEY]).toEqual(preferences({ showBrandWatermark: false }));
});

test("taskbar alignment persists through FsService root metadata", async () => {
  const fs = new PreferenceFs();
  await new ShellPreferenceStore(fs).save(preferences({ taskbarAlignment: "left" }));
  const loaded = await new ShellPreferenceStore(fs).load();
  expect(loaded.taskbarAlignment).toBe("left");
  expect(fs.root.metadata[SHELL_PREFERENCES_KEY]).toEqual(preferences({ taskbarAlignment: "left" }));
});

test("corrupt preference root metadata falls back to deterministic fresh defaults", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: [3],
    pinnedElements: [],
    themeId: "not-a-theme",
    wallpaper: "aurora",
  };
  expect(await new ShellPreferenceStore(fs).load()).toEqual(DEFAULT_SHELL_PREFERENCES);
});

test("invalid explicit appearance mode does not partially accept corrupt preferences", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    ...preferences({ wallpaper: { mode: "follow-theme" } }),
    appearanceMode: "system",
  } as unknown as JsonValue;
  expect(await new ShellPreferenceStore(fs).load()).toEqual(DEFAULT_SHELL_PREFERENCES);
});

test("invalid wallpaper falls back only that dimension without discarding valid Shell preferences", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-rosewood",
    appearanceMode: "light",
    wallpaper: { mode: "pinned", id: "not-a-wallpaper" },
    wallpaperLayout: "fill",
    taskbarAlignment: "left",
  };
  expect(await new ShellPreferenceStore(fs).load()).toEqual(preferences({
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-rosewood",
    appearanceMode: "light",
    taskbarAlignment: "left",
  }));
});

test("invalid explicit taskbar alignment does not partially accept corrupt preferences", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: [],
    themeId: "plasmon-midnight",
    wallpaper: "plain",
    taskbarAlignment: "right",
  };
  expect(await new ShellPreferenceStore(fs).load()).toEqual(DEFAULT_SHELL_PREFERENCES);
});

test("write failure keeps the selected in-memory preference outcome", async () => {
  const fs = new PreferenceFs();
  fs.failWrites = true;
  const selected = preferences({
    pinnedElements: ["mail"],
    appearanceMode: "light",
    wallpaper: { mode: "filesystem", nodeId: "node-failing-save" },
    wallpaperLayout: "center",
    taskbarAlignment: "left",
  });
  const outcome = await saveShellPreferencesNonDestructive(new ShellPreferenceStore(fs), selected);
  expect(outcome.saved).toBe(false);
  expect(outcome.error).toBeInstanceOf(Error);
  expect(outcome.preferences).toEqual(selected);
});

test("preference FsEvent does not trigger a save/reload loop", async () => {
  const fs = new PreferenceFs();
  const store = new ShellPreferenceStore(fs);
  await store.load();
  let events = 0;
  fs.subscribe(() => { events += 1; });

  await store.save(preferences({ pinnedNative: ["native:text"] }));
  await Promise.resolve();
  await Promise.resolve();

  expect(events).toBe(1);
  expect(fs.metadataWrites).toBe(1);
  expect(fs.resolveCalls).toBe(1);
});

test("hosted preference persistence has no localStorage requirement", async () => {
  const fs = new PreferenceFs();
  const store = new ShellPreferenceStore(fs);
  await store.save(preferences({ pinnedElements: ["calendar"] }));
  expect((await store.load()).pinnedElements).toEqual(["calendar"]);
});
