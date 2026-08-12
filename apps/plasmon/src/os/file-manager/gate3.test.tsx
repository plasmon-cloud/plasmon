import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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
import { FileOperationClipboard } from "./model.ts";
import { collisionFreeCopyName, normalizedCollisionName, pasteClipboardCollisionAware } from "./clipboard.ts";
import { createDocument, createGeneratedFolder } from "./create-import.ts";
import { deleteFilesystemNodes } from "./delete.ts";
import { downloadFsNode, readDownloadBlob, type DownloadEnvironment } from "./download.ts";
import { directoryDropTargetId } from "./drop-target.ts";
import { fileEntryClassName } from "./FileEntry.tsx";
import { fileManagerKeyboardCommand, isEditingKeyboardTarget } from "./keyboard.ts";
import { renameSelectionRange } from "./rename.ts";
import { readSharedShortcut, shortcutTypeLabel } from "./shortcut.ts";

function node(
  id: string,
  parentId: string | null,
  name: string,
  kind: FsNode["kind"] = "file",
  mime?: string,
  metadata: Record<string, JsonValue> = {},
): FsNode {
  return {
    id,
    parentId,
    name,
    kind,
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata,
    ...(mime ? { mime } : {}),
  };
}

class Gate3Fs implements FsService {
  readonly nodes = new Map<NodeId, FsNode>();
  readonly bytes = new Map<NodeId, Uint8Array>();
  readonly calls: Array<{ op: string; id?: NodeId; target?: NodeId; name?: string; recursive?: boolean }> = [];
  private sequence = 0;

  constructor(entries: readonly FsNode[]) {
    for (const entry of entries) this.nodes.set(entry.id, structuredClone(entry));
  }

  async stat(id: NodeId): Promise<FsNode> {
    const value = this.nodes.get(id);
    if (!value) throw new Error(`Unknown node ${id}`);
    return structuredClone(value);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    if (path === "/") return this.nodes.get("root") ?? null;
    for (const entry of this.nodes.values()) if (await this.pathOf(entry.id) === path) return structuredClone(entry);
    return null;
  }

  async pathOf(id: NodeId): Promise<string> {
    const current = await this.stat(id);
    if (current.parentId === null) return "/";
    const parent = await this.pathOf(current.parentId);
    return parent === "/" ? `/${current.name}` : `${parent}/${current.name}`;
  }

  async list(parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> {
    return [...this.nodes.values()].filter((entry) => entry.parentId === parentId).map((entry) => structuredClone(entry));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    if ([...this.nodes.values()].some((entry) => entry.parentId === parentId && normalizedCollisionName(entry.name) === normalizedCollisionName(name))) {
      throw new Error("A sibling already exists");
    }
    const created = node(`dir-${++this.sequence}`, parentId, name, "directory");
    this.nodes.set(created.id, created);
    this.calls.push({ op: "mkdir", target: parentId, name });
    return structuredClone(created);
  }

  async createFile(parentId: NodeId, name: string, options?: CreateFileOptions): Promise<FsNode> {
    if ([...this.nodes.values()].some((entry) => entry.parentId === parentId && normalizedCollisionName(entry.name) === normalizedCollisionName(name))) {
      throw new Error("A sibling already exists");
    }
    const created = node(`file-${++this.sequence}`, parentId, name, options?.kind ?? "file", options?.mime, options?.metadata ?? {});
    this.nodes.set(created.id, created);
    this.bytes.set(created.id, new Uint8Array());
    this.calls.push({ op: "create", target: parentId, name });
    return structuredClone(created);
  }

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    const value = this.bytes.get(id) ?? new Uint8Array();
    if (!range) return value.slice();
    return value.slice(range.offset, range.offset + range.length);
  }

  async write(id: NodeId, input: Uint8Array, options?: WriteOptions): Promise<FsNode> {
    const current = this.bytes.get(id) ?? new Uint8Array();
    const offset = options?.offset ?? 0;
    const initial = options?.truncate ? new Uint8Array() : current;
    const size = Math.max(initial.length, offset + input.length);
    const next = new Uint8Array(size);
    next.set(initial);
    next.set(input, offset);
    this.bytes.set(id, next);
    const entry = await this.stat(id);
    const changed = { ...entry, size: next.length };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const current = await this.stat(id);
    const changed = { ...current, name: newName };
    this.nodes.set(id, changed);
    this.calls.push({ op: "rename", id, name: newName });
    return structuredClone(changed);
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const current = await this.stat(id);
    const changed = { ...current, parentId: newParentId };
    this.nodes.set(id, changed);
    this.calls.push({ op: "move", id, target: newParentId });
    return structuredClone(changed);
  }

  async copy(id: NodeId, newParentId: NodeId, nameOverride?: string): Promise<FsNode> {
    const current = await this.stat(id);
    const copied = { ...current, id: `copy-${++this.sequence}`, parentId: newParentId, name: nameOverride ?? current.name };
    this.nodes.set(copied.id, copied);
    const sourceBytes = this.bytes.get(id);
    if (sourceBytes) this.bytes.set(copied.id, sourceBytes.slice());
    this.calls.push({ op: "copy", id, target: newParentId, name: copied.name });
    return structuredClone(copied);
  }

  async remove(id: NodeId, options?: { recursive?: boolean }): Promise<void> {
    const current = await this.stat(id);
    const children = [...this.nodes.values()].filter((entry) => entry.parentId === id);
    if (children.length > 0 && !options?.recursive) throw new Error("Directory not empty");
    if (options?.recursive) for (const child of children) await this.remove(child.id, { recursive: true });
    this.nodes.delete(current.id);
    this.bytes.delete(current.id);
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

  async revision(): Promise<Revision> { return 1n; }
}

test("Delete key routes to deletion while editable targets suppress it", async () => {
  expect(fileManagerKeyboardCommand("Delete", false)).toBe("delete");
  expect(fileManagerKeyboardCommand("Delete", true)).toBe("delete");
  expect(isEditingKeyboardTarget({ closest: () => ({ tagName: "INPUT" }) })).toBe(true);
  expect(isEditingKeyboardTarget({ closest: () => null })).toBe(false);

  const fs = new Gate3Fs([
    node("root", null, "", "directory"),
    node("a", "root", "a.txt"),
    node("folder", "root", "Folder", "directory"),
    node("child", "folder", "child.txt"),
  ]);
  const trash = {
    trash: async (id: NodeId) => fs.remove(id, { recursive: true }),
  };
  const result = await deleteFilesystemNodes(trash, [await fs.stat("a"), await fs.stat("folder")]);
  expect(result.failures).toEqual([]);
  expect(fs.nodes.has("a")).toBe(false);
  expect(fs.nodes.has("folder")).toBe(false);
  expect(fs.nodes.has("child")).toBe(false);
});

test("generated folder and document names progress without user-visible collisions", async () => {
  const fs = new Gate3Fs([
    node("root", null, "", "directory"),
    node("folder", "root", "New Folder", "directory"),
    node("text", "root", "New Text Document.txt", "file", "text/plain"),
    node("md", "root", "New Markdown Document.md", "file", "text/markdown"),
  ]);
  expect((await createGeneratedFolder(fs, "root")).name).toBe("New Folder (1)");
  expect((await createGeneratedFolder(fs, "root")).name).toBe("New Folder (2)");
  expect((await createDocument(fs, "root", "text")).name).toBe("New Text Document (1).txt");
  expect((await createDocument(fs, "root", "markdown")).name).toBe("New Markdown Document (1).md");
});

test("copy naming recognizes existing numeric families and preserves extensions", async () => {
  const occupied = new Set(["a.md", "a (1).md"].map(normalizedCollisionName));
  expect(collisionFreeCopyName("a.md", false, occupied)).toBe("a (2).md");
  expect(collisionFreeCopyName("a (1).md", false, occupied)).toBe("a (2).md");
  expect(collisionFreeCopyName("Folder (1)", true, new Set(["folder (1)"].map(normalizedCollisionName)))).toBe("Folder (2)");
  expect(collisionFreeCopyName(".env", false, new Set([".env"].map(normalizedCollisionName)))).toBe(".env (1)");
  expect(collisionFreeCopyName("README", false, new Set(["readme"].map(normalizedCollisionName)))).toBe("README (1)");

  const fs = new Gate3Fs([
    node("root", null, "", "directory"),
    node("a", "root", "a.md"),
    node("a1", "root", "a (1).md"),
  ]);
  const clipboard = new FileOperationClipboard();
  clipboard.copy(["a1"]);
  const [copied] = await pasteClipboardCollisionAware(fs, "root", clipboard);
  expect(copied?.name).toBe("a (2).md");
});

test("rename selection is basename-only for files and full-name for directories", () => {
  expect(renameSelectionRange("report.final.txt", false)).toEqual([0, 12]);
  expect(renameSelectionRange("Folder.with.dots", true)).toEqual([0, 16]);
  expect(renameSelectionRange("README", false)).toEqual([0, 6]);
  expect(renameSelectionRange(".env", false)).toEqual([0, 4]);
});

test("filename presentation exposes selected/rename/drop-target state", () => {
  expect(fileEntryClassName("desktop", false, false, false, false)).toBe("fm-entry fm-entry--desktop");
  expect(fileEntryClassName("desktop", true, false, false, false)).toContain("is-selected");
  expect(fileEntryClassName("desktop", false, false, true, false)).toContain("is-renaming");
  expect(fileEntryClassName("desktop", false, false, false, true)).toContain("is-drop-target");
});

test("folder drop target only selects a non-source directory", () => {
  const entries = [node("file", "root", "file.txt"), node("folder", "root", "Folder", "directory")];
  expect(directoryDropTargetId(entries, ["file"], "folder")).toBe("folder");
  expect(directoryDropTargetId(entries, ["folder"], "folder")).toBeNull();
  expect(directoryDropTargetId(entries, ["folder"], "file")).toBeNull();
});

test("Download reads FsService bytes, keeps filename/MIME, and revokes its object URL", async () => {
  const file = { ...node("file", "root", "movie.bin", "file", "application/octet-stream"), size: 5 };
  const fs = new Gate3Fs([node("root", null, "", "directory"), file]);
  fs.bytes.set("file", new Uint8Array([1, 2, 3, 4, 5]));
  const blob = await readDownloadBlob(fs, file, 2);
  expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4, 5]);
  expect(blob.type).toBe("application/octet-stream");

  let clicked = false;
  let removed = false;
  let revoked = "";
  let href = "";
  let download = "";
  const environment: DownloadEnvironment = {
    createObjectURL: () => "blob:test",
    revokeObjectURL: (url) => { revoked = url; },
    createAnchor: () => ({
      get href() { return href; }, set href(value) { href = value; },
      get download() { return download; }, set download(value) { download = value; },
      click: () => { clicked = true; },
      remove: () => { removed = true; },
    }),
    scheduleCleanup: (callback) => callback(),
  };
  await downloadFsNode(fs, file, environment);
  expect({ clicked, removed, revoked, href, download }).toEqual({
    clicked: true,
    removed: true,
    revoked: "blob:test",
    href: "blob:test",
    download: "movie.bin",
  });
});

test("shared shortcut nodes render as shortcuts and preserve their own NodeId on rename/move", async () => {
  const metadata: Record<string, JsonValue> = {
    "plasmon.shortcut": {
      format: "plasmon.shortcut",
      version: 1,
      target: { kind: "node", nodeId: "target-node" },
    },
  };
  const shortcut = node("shortcut-id", "root", "Report shortcut", "shortcut", undefined, metadata);
  const parsed = readSharedShortcut(shortcut);
  expect(parsed?.target).toEqual({ kind: "node", nodeId: "target-node" });
  expect(shortcutTypeLabel(shortcut)).toBe("File shortcut");

  const fs = new Gate3Fs([node("root", null, "", "directory"), node("dest", "root", "Dest", "directory"), shortcut]);
  expect((await fs.rename("shortcut-id", "Renamed shortcut")).id).toBe("shortcut-id");
  expect((await fs.move("shortcut-id", "dest")).id).toBe("shortcut-id");
});

test("FileManager owns Delete and specialized context-menu browser events", () => {
  const source = readFileSync(new URL("./FileManager.tsx", import.meta.url), "utf8");
  expect(source).toContain("onKeyDownCapture={handleKeyDown}");
  expect(source).toContain('command === "delete"');
  expect(source).toContain("void removeSelected()");
  expect(source).toContain("event.preventDefault();");
  expect(source).toContain('onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => event.preventDefault()}');
  expect(source).toContain('onClick={() => menuAction("download")}');
});
