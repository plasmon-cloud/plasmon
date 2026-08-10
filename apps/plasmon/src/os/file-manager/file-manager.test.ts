import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import type {
  AssociationRegistry,
  AssociationRule,
  CreateFileOptions,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  HandlerDefinition,
  HandlerId,
  JsonValue,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import {
  FileOperationClipboard,
  RefreshGate,
  beginRename,
  cancelRename,
  captureMarqueeRectangles,
  clearSelection,
  commitRename,
  decideEntryPointerSelection,
  deleteNodes,
  emptySelection,
  marqueeSelection,
  openNodeWithAssociations,
  pasteClipboard,
  selectAll,
  selectNode,
  updateRename,
  validateDirectoryDrop,
} from "./model.ts";
import { inspectProperties } from "./properties.tsx";
import {
  DESKTOP_POSITIONS_METADATA_KEY,
  parseDesktopPositions,
  repositionDesktopNodes,
} from "../desktop/Desktop.tsx";
import { ExplorerHistory } from "../../native-apps/explorer/history.ts";

function node(
  id: string,
  parentId: string | null,
  name: string,
  kind: FsNode["kind"] = "file",
  metadata: Record<string, JsonValue> = {},
): FsNode {
  return {
    id,
    parentId,
    name,
    kind,
    size: kind === "directory" ? 0 : 12,
    createdAt: 1_700_000_000_000,
    modifiedAt: 1_700_000_100_000,
    metadata,
    ...(kind === "file" ? { mime: "text/plain", contentHash: `hash-${id}` } : {}),
  };
}

class FakeFs implements FsService {
  readonly nodes = new Map<NodeId, FsNode>();
  readonly calls: Array<{ op: string; id?: string; target?: string; recursive?: boolean; name?: string }> = [];
  private revisionValue = 1n;

  constructor(nodes: readonly FsNode[]) {
    for (const entry of nodes) this.nodes.set(entry.id, structuredClone(entry));
  }

  async stat(id: NodeId): Promise<FsNode> {
    const value = this.nodes.get(id);
    if (!value) throw new Error(`Unknown node: ${id}`);
    return structuredClone(value);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    for (const value of this.nodes.values()) {
      if (await this.pathOf(value.id) === path) return structuredClone(value);
    }
    return null;
  }

  async pathOf(id: NodeId): Promise<string> {
    const current = this.nodes.get(id);
    if (!current) throw new Error(`Unknown node: ${id}`);
    if (current.parentId === null) return "/";
    const parent = await this.pathOf(current.parentId);
    return parent === "/" ? `/${current.name}` : `${parent}/${current.name}`;
  }

  async list(parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> {
    return [...this.nodes.values()].filter((entry) => entry.parentId === parentId).map((entry) => structuredClone(entry));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    const created = node(`mkdir-${this.nodes.size}`, parentId, name, "directory");
    this.nodes.set(created.id, created);
    this.calls.push({ op: "mkdir", target: parentId, name });
    return structuredClone(created);
  }

  async createFile(parentId: NodeId, name: string, options?: CreateFileOptions): Promise<FsNode> {
    const created = node(`file-${this.nodes.size}`, parentId, name, options?.kind ?? "file", options?.metadata ?? {});
    this.nodes.set(created.id, created);
    return structuredClone(created);
  }

  async read(_id: NodeId, _range?: FsReadRange): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async write(id: NodeId, _bytes: Uint8Array, _options?: WriteOptions): Promise<FsNode> {
    return this.stat(id);
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    if (newName === "taken.txt") throw new Error("Name already exists");
    const current = await this.stat(id);
    const renamed = { ...current, name: newName, modifiedAt: current.modifiedAt + 1 };
    this.nodes.set(id, renamed);
    this.calls.push({ op: "rename", id, name: newName });
    return structuredClone(renamed);
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const current = await this.stat(id);
    const moved = { ...current, parentId: newParentId };
    this.nodes.set(id, moved);
    this.calls.push({ op: "move", id, target: newParentId });
    return structuredClone(moved);
  }

  async copy(id: NodeId, newParentId: NodeId, nameOverride?: string): Promise<FsNode> {
    const current = await this.stat(id);
    const copied = { ...current, id: `${id}-copy-${this.nodes.size}`, parentId: newParentId, name: nameOverride ?? current.name };
    this.nodes.set(copied.id, copied);
    this.calls.push({ op: "copy", id, target: newParentId });
    return structuredClone(copied);
  }

  async remove(id: NodeId, options?: { recursive?: boolean }): Promise<void> {
    await this.stat(id);
    const children = [...this.nodes.values()].filter((entry) => entry.parentId === id);
    if (children.length > 0 && !options?.recursive) throw new Error("Directory is not empty");
    if (options?.recursive) {
      for (const child of children) await this.remove(child.id, { recursive: true });
    }
    this.nodes.delete(id);
    this.calls.push({ op: "remove", id, recursive: options?.recursive ?? false });
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    const current = await this.stat(id);
    const metadata = { ...current.metadata };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete metadata[key];
      else metadata[key] = value;
    }
    const changed = { ...current, metadata };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }

  async revision(): Promise<Revision> {
    return this.revisionValue;
  }
}

class FakeRegistry implements AssociationRegistry {
  readonly handler: HandlerDefinition = {
    id: "native:text",
    kind: "native",
    name: "Text Editor",
    icon: "system:text",
    capabilities: ["read", "write"],
  };
  resolveCalls = 0;
  defaultWrites: Array<{ typeKey: string; handlerId: HandlerId }> = [];

  registerHandler(_handler: HandlerDefinition): void {}
  registerRule(_rule: AssociationRule): void {}
  getHandler(id: HandlerId): HandlerDefinition | null { return id === this.handler.id ? this.handler : null; }
  async resolve(_node: FsNode, _contentProbe?: Uint8Array): Promise<HandlerDefinition[]> {
    this.resolveCalls += 1;
    return [this.handler];
  }
  async getDefault(_node: FsNode): Promise<HandlerDefinition | null> { return this.handler; }
  async setUserDefault(typeKey: string, handlerId: HandlerId): Promise<void> {
    this.defaultWrites.push({ typeKey, handlerId });
  }
}

test("selection toggle/add/range/select-all/clear remains keyed by NodeId", () => {
  const ids = ["node-a", "node-b", "node-c"];
  let selection = selectNode(emptySelection(), ids, "node-a");
  selection = selectNode(selection, ids, "node-c", { additive: true });
  expect([...selection.ids]).toEqual(["node-a", "node-c"]);
  selection = selectNode(selection, ids, "node-a", { additive: true });
  expect([...selection.ids]).toEqual(["node-c"]);
  selection = selectNode(selection, ids, "node-a");
  selection = selectNode(selection, ids, "node-c", { range: true });
  expect([...selection.ids]).toEqual(ids);
  expect([...selectAll(ids).ids]).toEqual(ids);
  expect(clearSelection().ids.size).toBe(0);
  const stable = selectNode(emptySelection(), ids, "node-b");
  expect(stable.ids.has("node-b")).toBe(true);
});

test("pointer-down on a selected member preserves the group for drag and no-drag release collapses", () => {
  const ids = ["a", "b", "c"];
  let selection = selectNode(emptySelection(), ids, "a");
  selection = selectNode(selection, ids, "b", { additive: true });

  const decision = decideEntryPointerSelection(selection, ids, "a");
  expect([...decision.selection.ids]).toEqual(["a", "b"]);
  expect(decision.dragIds).toEqual(["a", "b"]);
  expect(decision.releaseSelection ? [...decision.releaseSelection.ids] : null).toEqual(["a"]);
});

test("normal pointer-down on an unselected item selects only that item", () => {
  const ids = ["a", "b", "c"];
  let selection = selectNode(emptySelection(), ids, "a");
  selection = selectNode(selection, ids, "b", { additive: true });

  const decision = decideEntryPointerSelection(selection, ids, "c");
  expect([...decision.selection.ids]).toEqual(["c"]);
  expect(decision.dragIds).toEqual(["c"]);
  expect(decision.releaseSelection).toBeNull();
});

test("marquee selects intersections and modifier toggles against starting selection", () => {
  const rects = new Map([
    ["a", { left: 0, top: 0, right: 30, bottom: 30 }],
    ["b", { left: 50, top: 50, right: 80, bottom: 80 }],
    ["c", { left: 100, top: 100, right: 130, bottom: 130 }],
  ]);
  expect([...marqueeSelection(new Set(), rects, { left: 20, top: 20, right: 70, bottom: 70 }, false)]).toEqual(["a", "b"]);
  expect([...marqueeSelection(new Set(["a", "c"]), rects, { left: 20, top: 20, right: 70, bottom: 70 }, true)]).toEqual(["c", "b"]);
});

test("captured marquee rectangles are reused across multiple marquee positions", () => {
  const source = new Map([
    ["a", { left: 0, top: 0, right: 20, bottom: 20 }],
    ["b", { left: 40, top: 40, right: 60, bottom: 60 }],
  ]);
  let reads = 0;
  const captured = captureMarqueeRectangles(["a", "b"], (id) => {
    reads += 1;
    return source.get(id);
  });
  expect(reads).toBe(2);
  expect([...marqueeSelection(new Set(), captured, { left: 0, top: 0, right: 25, bottom: 25 }, false)]).toEqual(["a"]);
  source.get("a")!.left = 200;
  source.get("a")!.right = 220;
  expect([...marqueeSelection(new Set(), captured, { left: 35, top: 35, right: 65, bottom: 65 }, false)]).toEqual(["b"]);
  expect([...marqueeSelection(new Set(), captured, { left: 0, top: 0, right: 25, bottom: 25 }, false)]).toEqual(["a"]);
  expect(reads).toBe(2);
});

test("rename commit, cancel, and service error semantics are explicit", async () => {
  const fs = new FakeFs([node("root", null, "", "directory"), node("a", "root", "draft.txt")]);
  const draft = updateRename(beginRename(await fs.stat("a")), "final.txt");
  const renamed = await commitRename(fs, draft);
  expect(renamed.id).toBe("a");
  expect(renamed.name).toBe("final.txt");
  expect(cancelRename(beginRename(renamed))).toBeNull();
  await expect(commitRename(fs, updateRename(beginRename(renamed), "taken.txt"))).rejects.toThrow("already exists");
});

test("file-operation clipboard distinguishes copy from cut/move", async () => {
  const fs = new FakeFs([
    node("root", null, "", "directory"), node("desktop", "root", "Desktop", "directory"),
    node("docs", "root", "Documents", "directory"), node("a", "desktop", "a.txt"),
  ]);
  const clipboard = new FileOperationClipboard();
  clipboard.copy(["a"]);
  await pasteClipboard(fs, "docs", clipboard);
  expect(fs.calls.some((call) => call.op === "copy" && call.id === "a" && call.target === "docs")).toBe(true);
  expect(clipboard.snapshot()?.mode).toBe("copy");
  clipboard.cut(["a"]);
  await pasteClipboard(fs, "docs", clipboard);
  expect(fs.calls.some((call) => call.op === "move" && call.id === "a" && call.target === "docs")).toBe(true);
  expect(clipboard.snapshot()).toBeNull();
});

test("delete uses recursive removal for directories", async () => {
  const fs = new FakeFs([
    node("root", null, "", "directory"), node("folder", "root", "Folder", "directory"),
    node("child", "folder", "child.txt"), node("file", "root", "loose.txt"),
  ]);
  await deleteNodes(fs, [await fs.stat("folder"), await fs.stat("file")]);
  expect(fs.nodes.has("folder")).toBe(false);
  expect(fs.nodes.has("child")).toBe(false);
  expect(fs.calls.some((call) => call.op === "remove" && call.id === "folder" && call.recursive)).toBe(true);
});

test("directory drop rejects self, no-op, and descendant moves before FsService.move", async () => {
  const fs = new FakeFs([
    node("root", null, "", "directory"), node("parent", "root", "Parent", "directory"),
    node("child", "parent", "Child", "directory"), node("leaf", "child", "Leaf", "directory"),
    node("file", "root", "file.txt"),
  ]);
  await expect(validateDirectoryDrop(fs, [await fs.stat("parent")], await fs.stat("parent"))).rejects.toThrow(/itself/i);
  await expect(validateDirectoryDrop(fs, [await fs.stat("child")], await fs.stat("parent"))).rejects.toThrow(/already/i);
  await expect(validateDirectoryDrop(fs, [await fs.stat("parent")], await fs.stat("leaf"))).rejects.toThrow(/descendants/i);
  await validateDirectoryDrop(fs, [await fs.stat("file")], await fs.stat("child"));
  expect(fs.calls.some((call) => call.op === "move")).toBe(false);
});

test("desktop placement is NodeId keyed and survives rename", async () => {
  const root = node("root", null, "", "directory");
  const desktop = node("desktop", "root", "Desktop", "directory", { [DESKTOP_POSITIONS_METADATA_KEY]: { "stable-node": { x: 40, y: 60 } } });
  const file = node("stable-node", "desktop", "before.txt");
  const fs = new FakeFs([root, desktop, file]);
  const parsed = parseDesktopPositions(desktop.metadata[DESKTOP_POSITIONS_METADATA_KEY]);
  const moved = repositionDesktopNodes(parsed, [file], [file.id], { dx: 20, dy: 10 }, { width: 800, height: 600 });
  await fs.rename(file.id, "after.txt");
  expect(moved["stable-node"]).toEqual({ x: 60, y: 70 });
  expect((await fs.stat(file.id)).id).toBe("stable-node");
});

test("RefreshGate prevents older async refresh from overwriting a newer request", async () => {
  const gate = new RefreshGate();
  const applied: string[] = [];
  const oldGeneration = gate.begin();
  const newGeneration = gate.begin();
  await Promise.resolve();
  if (gate.isCurrent(newGeneration)) applied.push("new");
  if (gate.isCurrent(oldGeneration)) applied.push("old");
  expect(applied).toEqual(["new"]);
});

test("Explorer history truncates forward navigation and retains NodeId identity", () => {
  const history = new ExplorerHistory({ nodeId: "root", path: "/" });
  history.push({ nodeId: "docs", path: "/Documents" });
  history.push({ nodeId: "work", path: "/Documents/Work" });
  expect(history.back()).toEqual({ nodeId: "docs", path: "/Documents" });
  history.replaceCurrent({ nodeId: "docs", path: "/RenamedDocuments" });
  expect(history.current()?.nodeId).toBe("docs");
  expect(history.forward()?.nodeId).toBe("work");
  history.back();
  history.push({ nodeId: "desktop", path: "/Desktop" });
  expect(history.canForward()).toBe(false);
});

test("Properties inspection reads current FsService path, handler, Atom identity, and content hash", async () => {
  const atomMetadata: Record<string, JsonValue> = {
    atom: { format: "plasmon.atom", version: 1, atomId: "atom-123", handlerId: "native:text", atomType: "notes/v1", schemaVersion: 1 },
  };
  const fs = new FakeFs([
    node("root", null, "", "directory"), node("desktop", "root", "Desktop", "directory"),
    { ...node("atom", "desktop", "Notes.notes.atom", "atom", atomMetadata), contentHash: "content-abc" },
  ]);
  const registry = new FakeRegistry();
  const inspection = await inspectProperties(fs, registry, "atom");
  expect(inspection.path).toBe("/Desktop/Notes.notes.atom");
  expect(inspection.location).toBe("/Desktop");
  expect(inspection.extension).toBe(".atom");
  expect(inspection.defaultHandler?.id).toBe("native:text");
  expect(inspection.atom?.atomId).toBe("atom-123");
  expect(inspection.node.contentHash).toBe("content-abc");
});

test("Properties effective default comes from probe-aware Open With resolution", async () => {
  const handlerA: HandlerDefinition = {
    id: "native:a",
    kind: "native",
    name: "Probe-less A",
    icon: "system:a",
    capabilities: ["url"],
  };
  const handlerB: HandlerDefinition = {
    id: "native:b",
    kind: "native",
    name: "Probe-aware B",
    icon: "system:b",
    capabilities: ["url"],
  };
  let getDefaultCalls = 0;
  const registry: AssociationRegistry = {
    registerHandler: () => undefined,
    registerRule: () => undefined,
    getHandler: (id) => id === handlerA.id ? handlerA : id === handlerB.id ? handlerB : null,
    resolve: async (_resource, probe) => probe === undefined ? [handlerA] : [handlerB],
    getDefault: async () => { getDefaultCalls += 1; return handlerA; },
    setUserDefault: async () => undefined,
  };
  const fs = new FakeFs([
    node("root", null, "", "directory"),
    node("shortcut", "root", "Demo.url", "shortcut"),
  ]);

  const inspection = await inspectProperties(fs, registry, "shortcut");
  expect(inspection.compatibleHandlers.map((handler) => handler.id)).toEqual(["native:b"]);
  expect(inspection.defaultHandler?.id).toBe("native:b");
  expect(getDefaultCalls).toBe(0);
});

test("Open delegates to the existing association/Open With service instead of reimplementing defaults", async () => {
  const fs = new FakeFs([node("root", null, "", "directory"), node("file", "root", "readme.txt")]);
  const registry = new FakeRegistry();
  const opened: Array<{ handlerId: HandlerId; nodeId?: NodeId }> = [];
  await openNodeWithAssociations(fs, registry, {
    open: async (handlerId, target) => { opened.push({ handlerId, ...(target.nodeId ? { nodeId: target.nodeId } : {}) }); },
  }, "file");
  assert.ok(registry.resolveCalls >= 1);
  expect(registry.defaultWrites).toEqual([]);
  expect(opened).toEqual([{ handlerId: "native:text", nodeId: "file" }]);
});
