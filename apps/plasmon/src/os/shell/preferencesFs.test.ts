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
  SHELL_PREFERENCES_KEY,
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
    wallpaper: { mode: "follow-theme" },
    showBrandWatermark: true,
    taskbarAlignment: "center",
    taskbarPlacement: "bottom",
    taskbarIconSize: "medium",
    showNeutronTray: true,
    ...patch,
  };
}

test("legacy v1 Shell preferences preserve existing values and migrate wallpaper to Follow theme", async () => {
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
  expect(loaded.wallpaper).toEqual({ mode: "pinned", id: "plasmon-lattice" });
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

test("corrupt preference root metadata falls back to deterministic Graphite defaults", async () => {
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

test("invalid wallpaper falls back only that dimension without discarding valid Shell preferences", async () => {
  const fs = new PreferenceFs();
  fs.root.metadata[SHELL_PREFERENCES_KEY] = {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-rosewood",
    wallpaper: { mode: "pinned", id: "not-a-wallpaper" },
    taskbarAlignment: "left",
  };
  expect(await new ShellPreferenceStore(fs).load()).toEqual(preferences({
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-rosewood",
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
    wallpaper: { mode: "pinned", id: "glacier-prism" },
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
