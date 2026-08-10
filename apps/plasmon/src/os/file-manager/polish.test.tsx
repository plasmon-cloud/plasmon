import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CreateFileOptions,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  JsonValue,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import { allocateDesktopPositions } from "../desktop/layout.ts";
import { resolveExplorerAddress } from "../../native-apps/explorer/navigation.ts";
import { collisionFreeCopyName, normalizedCollisionName, pasteClipboardCollisionAware } from "./clipboard.ts";
import { importFileIntoFs } from "./create-import.ts";
import { ErrorBanner } from "./ErrorBanner.tsx";
import { fileVisualKind } from "./file-icons.ts";
import { fileManagerKeyboardCommand, isEditingKeyboardTarget } from "./keyboard.ts";
import { FileOperationClipboard, renameNode } from "./model.ts";
import { RenameSelectionController, renameKeyAction } from "./rename.ts";
import { canLoadImageThumbnail, loadImageThumbnail } from "./thumbnail.ts";

function makeNode(
  id: NodeId,
  parentId: NodeId | null,
  name: string,
  kind: FsNode["kind"] = "file",
  mime?: string,
): FsNode {
  return {
    id,
    parentId,
    name,
    kind,
    size: 0,
    createdAt: 1_700_000_000_000,
    modifiedAt: 1_700_000_000_000,
    metadata: {},
    ...(mime ? { mime } : {}),
  };
}

class FakeFs implements FsService {
  readonly nodes = new Map<NodeId, FsNode>();
  readonly bytes = new Map<NodeId, Uint8Array>();
  readonly copies: Array<{ id: NodeId; destinationId: NodeId; nameOverride?: string }> = [];
  private nextId = 1;

  constructor(nodes: readonly FsNode[]) {
    for (const node of nodes) {
      this.nodes.set(node.id, structuredClone(node));
      this.bytes.set(node.id, new Uint8Array(node.size));
    }
  }

  private collision(parentId: NodeId, name: string, ignoreId?: NodeId): FsNode | undefined {
    const key = normalizedCollisionName(name);
    return [...this.nodes.values()].find((node) => node.parentId === parentId && node.id !== ignoreId && normalizedCollisionName(node.name) === key);
  }

  async stat(id: NodeId): Promise<FsNode> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown node: ${id}`);
    return structuredClone(node);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    for (const node of this.nodes.values()) {
      if (await this.pathOf(node.id) === path) return structuredClone(node);
    }
    return null;
  }

  async pathOf(id: NodeId): Promise<string> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown node: ${id}`);
    if (node.parentId === null) return "/";
    const parent = await this.pathOf(node.parentId);
    return parent === "/" ? `/${node.name}` : `${parent}/${node.name}`;
  }

  async list(parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> {
    return [...this.nodes.values()].filter((node) => node.parentId === parentId).map((node) => structuredClone(node));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    if (this.collision(parentId, name)) throw new Error("Name already exists");
    const node = makeNode(`node-${this.nextId++}`, parentId, name, "directory");
    this.nodes.set(node.id, node);
    this.bytes.set(node.id, new Uint8Array());
    return structuredClone(node);
  }

  async createFile(parentId: NodeId, name: string, options?: CreateFileOptions): Promise<FsNode> {
    if (this.collision(parentId, name)) throw new Error("Name already exists");
    const node = makeNode(`node-${this.nextId++}`, parentId, name, options?.kind ?? "file", options?.mime);
    node.metadata = options?.metadata ?? {};
    this.nodes.set(node.id, node);
    this.bytes.set(node.id, new Uint8Array());
    return structuredClone(node);
  }

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    const bytes = this.bytes.get(id) ?? new Uint8Array();
    const offset = range?.offset ?? 0;
    const end = range?.length === undefined ? bytes.length : Math.min(bytes.length, offset + range.length);
    return bytes.slice(offset, end);
  }

  async write(id: NodeId, incoming: Uint8Array, options?: WriteOptions): Promise<FsNode> {
    const node = await this.stat(id);
    const offset = options?.offset ?? 0;
    const old = options?.truncate ? new Uint8Array() : this.bytes.get(id) ?? new Uint8Array();
    const next = new Uint8Array(Math.max(old.length, offset + incoming.length));
    next.set(old.slice(0, next.length));
    next.set(incoming, offset);
    this.bytes.set(id, next);
    const changed = { ...node, size: next.length, modifiedAt: node.modifiedAt + 1 };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const node = await this.stat(id);
    if (node.parentId && this.collision(node.parentId, newName, id)) throw new Error("Name already exists");
    const changed = { ...node, name: newName, modifiedAt: node.modifiedAt + 1 };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const node = await this.stat(id);
    if (this.collision(newParentId, node.name, id)) throw new Error("Name already exists");
    const changed = { ...node, parentId: newParentId };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }

  async copy(id: NodeId, newParentId: NodeId, nameOverride?: string): Promise<FsNode> {
    const source = await this.stat(id);
    const name = nameOverride ?? source.name;
    if (this.collision(newParentId, name)) throw new Error("Name already exists");
    const copy = { ...source, id: `node-${this.nextId++}`, parentId: newParentId, name };
    this.nodes.set(copy.id, copy);
    this.bytes.set(copy.id, (this.bytes.get(id) ?? new Uint8Array()).slice());
    this.copies.push({ id, destinationId: newParentId, ...(nameOverride ? { nameOverride } : {}) });
    return structuredClone(copy);
  }

  async remove(id: NodeId, _options?: { recursive?: boolean }): Promise<void> {
    this.nodes.delete(id);
    this.bytes.delete(id);
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    const node = await this.stat(id);
    const metadata = { ...node.metadata };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete metadata[key];
      else metadata[key] = value;
    }
    const changed = { ...node, metadata };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }

  async revision(): Promise<Revision> { return 1n; }
}

test("initial rename selects basename once even as controlled value changes", () => {
  const controller = new RenameSelectionController();
  const calls: Array<readonly [number, number]> = [];
  let focusCount = 0;
  const input = {
    focus: () => { focusCount += 1; },
    setSelectionRange: (start: number, end: number) => { calls.push([start, end]); },
  };

  expect(controller.initialize(7, input, "draft.txt")).toBe(true);
  expect(controller.initialize(7, input, "d.md")).toBe(false);
  expect(focusCount).toBe(1);
  expect(calls).toEqual([[0, 5]]);
});

test("rename permits extension changes and Enter/Escape map to commit/cancel", async () => {
  const fs = new FakeFs([makeNode("root", null, "", "directory"), makeNode("file", "root", "draft.txt", "file", "text/plain")]);
  const renamed = await renameNode(fs, "file", "draft.md");
  expect(renamed.name).toBe("draft.md");
  expect(renameKeyAction("Enter")).toBe("commit");
  expect(renameKeyAction("Escape")).toBe("cancel");
});

test("new Desktop entries allocate distinct free slots without moving persisted entries", () => {
  const nodes = [makeNode("a", "desktop", "A"), makeNode("b", "desktop", "B"), makeNode("c", "desktop", "C")];
  const persisted = { a: { x: 16, y: 16 } };
  const allocated = allocateDesktopPositions(persisted, nodes);
  expect(allocated.a).toEqual({ x: 16, y: 16 });
  expect(allocated.b).not.toEqual(allocated.a);
  expect(allocated.c).not.toEqual(allocated.a);
  expect(allocated.c).not.toEqual(allocated.b);
  const reopened = allocateDesktopPositions(allocated, [...nodes].reverse());
  expect(reopened).toEqual(allocated);
});

test("copy paste suffixes file collisions before the extension", async () => {
  const root = makeNode("root", null, "", "directory");
  const source = makeNode("a", "root", "a.md", "file", "text/markdown");
  const fs = new FakeFs([root, source]);
  const clipboard = new FileOperationClipboard();
  clipboard.copy([source.id]);
  await pasteClipboardCollisionAware(fs, root.id, clipboard);
  await pasteClipboardCollisionAware(fs, root.id, clipboard);
  expect((await fs.list(root.id)).map((node) => node.name).sort()).toEqual(["a (1).md", "a (2).md", "a.md"]);
});

test("copy collision naming handles directories, dotfiles, files without extensions, and case folding", () => {
  const occupied = new Set(["Folder", ".env", "README", "A.MD"].map(normalizedCollisionName));
  expect(collisionFreeCopyName("Folder", true, occupied)).toBe("Folder (1)");
  expect(collisionFreeCopyName(".env", false, occupied)).toBe(".env (1)");
  expect(collisionFreeCopyName("README", false, occupied)).toBe("README (1)");
  expect(collisionFreeCopyName("a.md", false, occupied)).toBe("a (1).md");
});

test("file-manager keyboard command routing covers standard clipboard/delete/F2/select-all shortcuts", () => {
  expect(fileManagerKeyboardCommand("c", true)).toBe("copy");
  expect(fileManagerKeyboardCommand("x", true)).toBe("cut");
  expect(fileManagerKeyboardCommand("v", true)).toBe("paste");
  expect(fileManagerKeyboardCommand("a", true)).toBe("selectAll");
  expect(fileManagerKeyboardCommand("Delete", false)).toBe("delete");
  expect(fileManagerKeyboardCommand("F2", false)).toBe("rename");
  expect(fileManagerKeyboardCommand("c", false)).toBeNull();
});

test("editor and input targets suppress FileManager shortcuts", () => {
  const editable = { closest: (_selector: string) => ({ tagName: "INPUT" }) };
  const ordinary = { closest: (_selector: string) => null };
  expect(isEditingKeyboardTarget(editable)).toBe(true);
  expect(isEditingKeyboardTarget(ordinary)).toBe(false);
});

test("Explorer typed root address resolves root", async () => {
  const fs = new FakeFs([makeNode("root", null, "", "directory")]);
  expect(await resolveExplorerAddress(fs, "/")).toEqual({ nodeId: "root", path: "/" });
});

test("Explorer typed nested address resolves the requested directory", async () => {
  const fs = new FakeFs([
    makeNode("root", null, "", "directory"),
    makeNode("docs", "root", "Documents", "directory"),
    makeNode("work", "docs", "Work", "directory"),
  ]);
  expect(await resolveExplorerAddress(fs, "/Documents/Work")).toEqual({ nodeId: "work", path: "/Documents/Work" });
  await expect(resolveExplorerAddress(fs, "/Missing")).rejects.toThrow("Folder not found");
});

test("error banner exposes an explicit dismiss control", () => {
  const html = renderToStaticMarkup(<ErrorBanner message="Name already exists" onDismiss={() => undefined} onRetry={() => undefined} />);
  expect(html).toContain("Name already exists");
  expect(html).toContain("Dismiss");
  expect(html).toContain("Retry");
});

test("thumbnail object URLs are revoked and PNGs are classified as image entries", async () => {
  const root = makeNode("root", null, "", "directory");
  const png = { ...makeNode("png", "root", "face.png", "file", "image/png"), size: 4 };
  const fs = new FakeFs([root, png]);
  fs.bytes.set(png.id, new Uint8Array([1, 2, 3, 4]));
  let blob: Blob | null = null;
  const revoked: string[] = [];
  const loaded = await loadImageThumbnail(fs, png, {
    createObjectURL: (value) => { blob = value; return "blob:face"; },
    revokeObjectURL: (url) => { revoked.push(url); },
  });
  expect(canLoadImageThumbnail(png)).toBe(true);
  expect(fileVisualKind(png)).toBe("image");
  expect(loaded?.url).toBe("blob:face");
  expect(blob?.type).toBe("image/png");
  loaded?.revoke();
  expect(revoked).toEqual(["blob:face"]);
});

test("imported PNG remains a normal FsService file and receives thumbnail behavior", async () => {
  const root = makeNode("root", null, "", "directory");
  const fs = new FakeFs([root]);
  const sourceBytes = new Uint8Array([137, 80, 78, 71]);
  const imported = await importFileIntoFs(fs, root.id, {
    name: "imported.png",
    type: "image/png",
    size: sourceBytes.length,
    slice: (start = 0, end = sourceBytes.length) => ({
      arrayBuffer: async () => sourceBytes.slice(start, end).buffer as ArrayBuffer,
    }),
  }, 2);
  expect(imported.kind).toBe("file");
  expect(imported.name).toBe("imported.png");
  expect(imported.mime).toBe("image/png");
  expect(canLoadImageThumbnail(imported)).toBe(true);
  expect(fileVisualKind(imported)).toBe("image");
  expect([...await fs.read(imported.id)]).toEqual([...sourceBytes]);
});
