// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  ExternalElement,
  FsEvent,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  HandlerId,
  JsonValue,
  NativeAppDefinition,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import {
  resolveShellContextMenuPolicy,
  shouldDismissAfterResultActivation,
  shouldDismissShellFlyout,
  taskbarPinAction,
} from "./interactions.ts";
import {
  SEARCH_CATEGORY_LIMITS,
  SEARCH_TOTAL_LIMIT,
  LatestSearchController,
  searchShell,
  subscribeSearchInvalidation,
} from "./search.ts";
import {
  START_MENU_PATH,
  listStartMenuFolder,
  parseStartShortcut,
  reconcileStartMenu,
  type StartShortcut,
} from "./startMenu.ts";

class GateFs implements FsService, FsEventSource {
  private readonly nodes = new Map<NodeId, FsNode>();
  private readonly listeners = new Set<(event: FsEvent) => void>();
  private nextId = 1;
  private tick = 10;

  constructor() {
    this.nodes.set("root", {
      id: "root", parentId: null, name: "", kind: "directory", size: 0,
      createdAt: 1, modifiedAt: 1, metadata: {},
    });
  }

  async stat(id: NodeId): Promise<FsNode> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`missing node ${id}`);
    return this.clone(node);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    if (path === "/") return this.stat("root");
    let current = this.nodes.get("root")!;
    for (const part of path.split("/").filter(Boolean)) {
      const child = [...this.nodes.values()].find((node) => node.parentId === current.id && node.name === part);
      if (!child) return null;
      current = child;
    }
    return this.clone(current);
  }

  async pathOf(id: NodeId): Promise<string> {
    const parts: string[] = [];
    let current = this.nodes.get(id);
    if (!current) throw new Error(`missing node ${id}`);
    while (current.parentId) {
      parts.unshift(current.name);
      current = this.nodes.get(current.parentId);
      if (!current) throw new Error("broken parent");
    }
    return `/${parts.join("/")}`;
  }

  async list(parentId: NodeId, options: FsListOptions = {}): Promise<FsNode[]> {
    let result = [...this.nodes.values()].filter((node) => node.parentId === parentId);
    if (!options.includeHidden) result = result.filter((node) => !node.name.startsWith("."));
    if (options.sort === "modified") result.sort((a, b) => b.modifiedAt - a.modifiedAt);
    else result.sort((a, b) => a.name.localeCompare(b.name));
    return result.map((node) => this.clone(node));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    return this.create(parentId, name, "directory", {});
  }

  async createFile(parentId: NodeId, name: string, options: CreateFileOptions = {}): Promise<FsNode> {
    return this.create(parentId, name, options.kind ?? "file", options.metadata ?? {}, options.mime);
  }

  async read(_id: NodeId, _range?: FsReadRange): Promise<Uint8Array> { return new Uint8Array(); }
  async write(id: NodeId, bytes: Uint8Array, _options?: WriteOptions): Promise<FsNode> {
    const node = this.require(id);
    node.size = bytes.length;
    node.modifiedAt = ++this.tick;
    this.emit({ type: "changed", node: this.clone(node) });
    return this.clone(node);
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const node = this.require(id);
    node.name = newName;
    node.modifiedAt = ++this.tick;
    this.emit({ type: "changed", node: this.clone(node) });
    return this.clone(node);
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const node = this.require(id);
    const oldParentId = node.parentId;
    if (!oldParentId) throw new Error("cannot move root");
    node.parentId = newParentId;
    node.modifiedAt = ++this.tick;
    this.emit({ type: "moved", node: this.clone(node), oldParentId });
    return this.clone(node);
  }

  async copy(): Promise<FsNode> { throw new Error("unused"); }

  async remove(id: NodeId, options: { recursive?: boolean } = {}): Promise<void> {
    const node = this.require(id);
    const children = [...this.nodes.values()].filter((candidate) => candidate.parentId === id);
    if (children.length && !options.recursive) throw new Error("directory not empty");
    for (const child of children) await this.remove(child.id, { recursive: true });
    this.nodes.delete(id);
    if (node.parentId) this.emit({ type: "removed", id, parentId: node.parentId });
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    const node = this.require(id);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete node.metadata[key];
      else node.metadata[key] = structuredClone(value);
    }
    node.modifiedAt = ++this.tick;
    this.emit({ type: "changed", node: this.clone(node) });
    return this.clone(node);
  }

  async revision(): Promise<Revision> { return BigInt(this.tick); }

  subscribe(listener: (event: FsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private create(parentId: NodeId, name: string, kind: FsNode["kind"], metadata: Record<string, JsonValue>, mime?: string): FsNode {
    if (!this.nodes.has(parentId)) throw new Error(`missing parent ${parentId}`);
    if ([...this.nodes.values()].some((node) => node.parentId === parentId && node.name === name)) throw new Error(`duplicate ${name}`);
    const id = `n${this.nextId++}`;
    const node: FsNode = {
      id, parentId, name, kind, size: 0,
      ...(mime ? { mime } : {}),
      createdAt: ++this.tick,
      modifiedAt: this.tick,
      metadata: structuredClone(metadata),
    };
    this.nodes.set(id, node);
    this.emit({ type: "created", node: this.clone(node) });
    return this.clone(node);
  }

  private require(id: NodeId): FsNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`missing node ${id}`);
    return node;
  }

  private clone(node: FsNode): FsNode {
    return { ...node, metadata: structuredClone(node.metadata) };
  }

  private emit(event: FsEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

const textApp: NativeAppDefinition = {
  id: "native:text", handlerId: "native:text", name: "Text Editor", icon: "T",
  defaultWindow: { width: 700, height: 500 }, associations: [],
};
const settingsApp: NativeAppDefinition = {
  id: "native:settings", handlerId: "native:settings", name: "Settings", icon: "S",
  defaultWindow: { width: 700, height: 500 }, associations: [],
};
const mailElement: ExternalElement = {
  id: "mail", name: "Mail", description: "Neutron Mail", tiles: [{ id: "main", title: "Main" }], running: "unknown",
};

async function shortcutNodes(fs: GateFs): Promise<StartShortcut[]> {
  const root = await fs.resolvePath(START_MENU_PATH);
  if (!root) return [];
  const output: StartShortcut[] = [];
  const queue = [root];
  while (queue.length) {
    const folder = queue.shift()!;
    for (const node of await fs.list(folder.id, { includeHidden: true })) {
      if (node.kind === "directory") queue.push(node);
      else {
        const shortcut = parseStartShortcut(node);
        if (shortcut) output.push(shortcut);
      }
    }
  }
  return output;
}

test("Start is filesystem-backed with folders and seeded shortcut nodes", async () => {
  const fs = new GateFs();
  const result = await reconcileStartMenu(fs, [textApp, settingsApp], [mailElement]);
  expect(await fs.pathOf(result.root.id)).toBe(START_MENU_PATH);
  const rootEntries = await listStartMenuFolder(fs, result.root.id);
  expect(rootEntries.filter((node) => node.kind === "directory").map((node) => node.name)).toEqual(["Accessories", "Neutron", "System"]);
  const shortcuts = await shortcutNodes(fs);
  expect(shortcuts.map((item) => item.target.kind).sort()).toEqual(["element", "native", "native"]);
});

test("Start folder navigation lists child filesystem content", async () => {
  const fs = new GateFs();
  const { root } = await reconcileStartMenu(fs, [textApp], []);
  const accessories = (await listStartMenuFolder(fs, root.id)).find((node) => node.name === "Accessories");
  expect(accessories?.kind).toBe("directory");
  const children = await listStartMenuFolder(fs, accessories!.id);
  expect(children.map((node) => node.name)).toEqual(["Text Editor"]);
  expect(parseStartShortcut(children[0]!)?.target).toEqual({ kind: "native", handlerId: "native:text" });
});

test("Start reconciliation prevents duplicates and preserves user rename/move", async () => {
  const fs = new GateFs();
  const first = await reconcileStartMenu(fs, [textApp, settingsApp], [mailElement]);
  const before = await shortcutNodes(fs);
  const text = before.find((item) => item.target.kind === "native" && item.target.handlerId === "native:text")!;
  const system = (await fs.list(first.root.id, { includeHidden: true })).find((node) => node.name === "System")!;
  await fs.rename(text.node.id, "My Editor");
  await fs.move(text.node.id, system.id);

  await reconcileStartMenu(fs, [textApp, settingsApp], [mailElement]);
  const after = await shortcutNodes(fs);
  const preserved = after.find((item) => item.node.id === text.node.id)!;
  expect(after).toHaveLength(before.length);
  expect(preserved.node.name).toBe("My Editor");
  expect(preserved.node.parentId).toBe(system.id);
});

test("intentionally deleted seeded shortcut is not recreated", async () => {
  const fs = new GateFs();
  await reconcileStartMenu(fs, [textApp], [mailElement]);
  const mail = (await shortcutNodes(fs)).find((item) => item.target.kind === "element")!;
  await fs.remove(mail.node.id);
  const result = await reconcileStartMenu(fs, [textApp], [mailElement]);
  expect(result.skippedDeleted).toBe(1);
  expect((await shortcutNodes(fs)).some((item) => item.target.kind === "element")).toBe(false);
});

test("empty-query Search returns useful apps, Documents, Media, and Atoms", async () => {
  const fs = new GateFs();
  await fs.createFile("root", "notes.txt", { mime: "text/plain" });
  await fs.createFile("root", "face.png", { mime: "image/png" });
  await fs.createFile("root", "clip.mp4", { mime: "video/mp4" });
  await fs.createFile("root", "draft.atom", { kind: "atom" });
  const batch = await searchShell(fs, [textApp], [mailElement], "");
  expect(batch.results.some((result) => result.kind === "native-app")).toBe(true);
  expect(batch.results.some((result) => result.kind === "element")).toBe(true);
  expect(batch.results.some((result) => result.category === "documents" && result.title === "notes.txt")).toBe(true);
  expect(batch.results.some((result) => result.category === "media" && result.title === "face.png")).toBe(true);
  expect(batch.results.some((result) => result.category === "media" && result.title === "clip.mp4")).toBe(true);
  expect(batch.results.some((result) => result.category === "atoms" && result.title === "draft.atom")).toBe(true);
});

test("Search classification and result caps are bounded", async () => {
  const fs = new GateFs();
  for (let index = 0; index < 30; index += 1) await fs.createFile("root", `doc-${index}.md`, { mime: "text/markdown" });
  for (let index = 0; index < 30; index += 1) await fs.createFile("root", `image-${index}.png`, { mime: "image/png" });
  const batch = await searchShell(fs, [], [], "");
  expect(batch.results.filter((result) => result.category === "documents")).toHaveLength(SEARCH_CATEGORY_LIMITS.documents);
  expect(batch.results.filter((result) => result.category === "media")).toHaveLength(SEARCH_CATEGORY_LIMITS.media);
  expect(batch.results.length).toBeLessThanOrEqual(SEARCH_TOTAL_LIMIT);
  expect(batch.truncated).toBe(true);
});

test("FsEvent invalidation triggers a rescan that discovers newly created content", async () => {
  const fs = new GateFs();
  let latest = await searchShell(fs, [], [], "fresh");
  let pending: Promise<void> = Promise.resolve();
  const unsubscribe = subscribeSearchInvalidation(fs, () => {
    pending = searchShell(fs, [], [], "fresh").then((batch) => { latest = batch; });
  });
  await fs.createFile("root", "fresh.txt", { mime: "text/plain" });
  await pending;
  unsubscribe();
  expect(latest.results.some((result) => result.title === "fresh.txt")).toBe(true);
});

test("stale async searches cannot overwrite newer query state", async () => {
  const controller = new LatestSearchController<string>();
  const applied: string[] = [];
  let oldResolve!: (value: string) => void;
  let newResolve!: (value: string) => void;
  const oldValue = new Promise<string>((resolve) => { oldResolve = resolve; });
  const newValue = new Promise<string>((resolve) => { newResolve = resolve; });
  const oldRun = controller.run(() => oldValue, (value) => applied.push(value));
  const newRun = controller.run(() => newValue, (value) => applied.push(value));
  newResolve("new");
  expect(await newRun).toBe(true);
  oldResolve("old");
  expect(await oldRun).toBe(false);
  expect(applied).toEqual(["new"]);
});

test("successful result activation dismisses Search", () => {
  expect(shouldDismissAfterResultActivation(true)).toBe(true);
  expect(shouldDismissAfterResultActivation(false)).toBe(false);
});

test("click-away closes flyouts while inside and toggle interactions do not fight dismissal", () => {
  expect(shouldDismissShellFlyout(true, { insideFlyout: false, insideToggle: false, insideContextMenu: false })).toBe(true);
  expect(shouldDismissShellFlyout(true, { insideFlyout: true, insideToggle: false, insideContextMenu: false })).toBe(false);
  expect(shouldDismissShellFlyout(true, { insideFlyout: false, insideToggle: true, insideContextMenu: false })).toBe(false);
  expect(shouldDismissShellFlyout(false, { insideFlyout: false, insideToggle: false, insideContextMenu: false })).toBe(false);
});

test("Pin and Unpin state exposes exact taskbar tooltip labels", () => {
  expect(taskbarPinAction(false)).toEqual({ pinned: false, nextPinned: true, label: "Pin to taskbar" });
  expect(taskbarPinAction(true)).toEqual({ pinned: true, nextPinned: false, label: "Unpin from taskbar" });
});

test("Shell context-menu arbitration keeps app content free and specialized task menus win", () => {
  expect(resolveShellContextMenuPolicy({ shellOwned: false, nativeTask: false, elementTask: false })).toBe("none");
  expect(resolveShellContextMenuPolicy({ shellOwned: true, nativeTask: false, elementTask: false })).toBe("generic");
  expect(resolveShellContextMenuPolicy({ shellOwned: true, nativeTask: true, elementTask: false })).toBe("native-task");
  expect(resolveShellContextMenuPolicy({ shellOwned: true, nativeTask: false, elementTask: true })).toBe("element-task");
});