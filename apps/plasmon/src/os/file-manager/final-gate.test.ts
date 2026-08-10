import { expect, test } from "bun:test";
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
import { createDocument, importFileIntoFs, type ImportFileSource } from "./create-import.ts";
import { finishEntryDragGesture } from "./drag.ts";
import { emptySelection, selectNode } from "./model.ts";

function directory(id = "dir"): FsNode {
  return {
    id,
    parentId: null,
    name: id,
    kind: "directory",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

class RecordingFs implements FsService {
  readonly nodes = new Map<NodeId, FsNode>();
  readonly bytes = new Map<NodeId, Uint8Array>();
  readonly creates: Array<{ parentId: NodeId; name: string; options?: CreateFileOptions }> = [];
  readonly writes: Array<{ id: NodeId; bytes: Uint8Array; options?: WriteOptions }> = [];
  readonly removes: NodeId[] = [];
  failWriteOffset: number | null = null;
  private ordinal = 0;

  constructor() {
    this.nodes.set("dir", directory());
  }

  async stat(id: NodeId): Promise<FsNode> {
    const value = this.nodes.get(id);
    if (!value) throw new Error(`Unknown node ${id}`);
    return structuredClone(value);
  }
  async resolvePath(_path: string): Promise<FsNode | null> { return null; }
  async pathOf(id: NodeId): Promise<string> { return `/${(await this.stat(id)).name}`; }
  async list(parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> {
    return [...this.nodes.values()].filter((entry) => entry.parentId === parentId).map((entry) => structuredClone(entry));
  }
  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    const value = { ...directory(`mkdir-${++this.ordinal}`), parentId, name };
    this.nodes.set(value.id, value);
    return structuredClone(value);
  }
  async createFile(parentId: NodeId, name: string, options?: CreateFileOptions): Promise<FsNode> {
    if ([...this.nodes.values()].some((entry) => entry.parentId === parentId && entry.name === name)) {
      throw new Error(`${name} already exists`);
    }
    const id = `file-${++this.ordinal}`;
    const value: FsNode = {
      id,
      parentId,
      name,
      kind: options?.kind ?? "file",
      ...(options?.mime ? { mime: options.mime } : {}),
      size: 0,
      createdAt: 1,
      modifiedAt: 1,
      metadata: options?.metadata ? structuredClone(options.metadata) : {},
    };
    this.nodes.set(id, value);
    this.bytes.set(id, new Uint8Array());
    this.creates.push({ parentId, name, ...(options ? { options: structuredClone(options) } : {}) });
    return structuredClone(value);
  }
  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    const value = this.bytes.get(id) ?? new Uint8Array();
    if (!range) return value.slice();
    return value.slice(range.offset, range.offset + range.length);
  }
  async write(id: NodeId, incoming: Uint8Array, options?: WriteOptions): Promise<FsNode> {
    const offset = options?.offset ?? 0;
    if (this.failWriteOffset === offset) throw new Error("synthetic write failure");
    const current = options?.truncate ? new Uint8Array() : this.bytes.get(id) ?? new Uint8Array();
    const next = new Uint8Array(Math.max(current.length, offset + incoming.length));
    next.set(current);
    next.set(incoming, offset);
    this.bytes.set(id, next);
    const node = await this.stat(id);
    const changed = { ...node, size: next.length, modifiedAt: node.modifiedAt + 1 };
    this.nodes.set(id, changed);
    this.writes.push({ id, bytes: incoming.slice(), ...(options ? { options: { ...options } } : {}) });
    return structuredClone(changed);
  }
  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const value = { ...await this.stat(id), name: newName };
    this.nodes.set(id, value);
    return structuredClone(value);
  }
  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const value = { ...await this.stat(id), parentId: newParentId };
    this.nodes.set(id, value);
    return structuredClone(value);
  }
  async copy(id: NodeId, newParentId: NodeId, name?: string): Promise<FsNode> {
    const source = await this.stat(id);
    return this.createFile(newParentId, name ?? source.name, source.mime ? { mime: source.mime } : undefined);
  }
  async remove(id: NodeId, _options?: { recursive?: boolean }): Promise<void> {
    this.removes.push(id);
    this.nodes.delete(id);
    this.bytes.delete(id);
  }
  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    const value = await this.stat(id);
    const metadata = { ...value.metadata };
    for (const [key, item] of Object.entries(patch)) {
      if (item === null) delete metadata[key];
      else metadata[key] = item;
    }
    const changed = { ...value, metadata };
    this.nodes.set(id, changed);
    return structuredClone(changed);
  }
  async revision(): Promise<Revision> { return 1n; }
}

function source(name: string, type: string, data: Uint8Array): ImportFileSource {
  return {
    name,
    type,
    size: data.length,
    slice(start = 0, end = data.length) {
      const copy = data.slice(start, end);
      return { arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer };
    },
  };
}

test("New Text Document creates a normal .txt file with text/plain MIME", async () => {
  const fs = new RecordingFs();
  const created = await createDocument(fs, "dir", "text");
  expect(created.name).toBe("New Text Document.txt");
  expect(created.kind).toBe("file");
  expect(created.mime).toBe("text/plain");
  expect(fs.creates).toEqual([{ parentId: "dir", name: "New Text Document.txt", options: { mime: "text/plain" } }]);
});

test("New Markdown Document creates a normal .md file with text/markdown MIME", async () => {
  const fs = new RecordingFs();
  const created = await createDocument(fs, "dir", "markdown");
  expect(created.name).toBe("New Markdown Document.md");
  expect(created.kind).toBe("file");
  expect(created.mime).toBe("text/markdown");
  expect(fs.creates[0]?.options?.mime).toBe("text/markdown");
});

test("import preserves filename/MIME and writes the selected bytes", async () => {
  const fs = new RecordingFs();
  const data = new Uint8Array([1, 2, 3, 4, 5]);
  const imported = await importFileIntoFs(fs, "dir", source("clip.mp4", "video/mp4", data));
  expect(imported.name).toBe("clip.mp4");
  expect(imported.mime).toBe("video/mp4");
  expect([...fs.bytes.get(imported.id) ?? []]).toEqual([...data]);
  expect(fs.writes[0]?.options).toEqual({ offset: 0, truncate: true });
});

test("multi-chunk import writes bounded chunks at explicit offsets", async () => {
  const fs = new RecordingFs();
  const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const imported = await importFileIntoFs(fs, "dir", source("large.bin", "application/octet-stream", data), 3);
  expect(fs.writes.map((write) => write.options)).toEqual([
    { offset: 0, truncate: true },
    { offset: 3 },
    { offset: 6 },
  ]);
  expect(fs.writes.map((write) => write.bytes.length)).toEqual([3, 3, 2]);
  expect([...fs.bytes.get(imported.id) ?? []]).toEqual([...data]);
});

test("failed import removes the partially-created destination best-effort", async () => {
  const fs = new RecordingFs();
  fs.failWriteOffset = 3;
  await expect(importFileIntoFs(
    fs,
    "dir",
    source("broken.dat", "application/octet-stream", new Uint8Array([1, 2, 3, 4, 5, 6])),
    3,
  )).rejects.toThrow("synthetic write failure");
  expect(fs.removes).toEqual(["file-1"]);
  expect(fs.nodes.has("file-1")).toBe(false);
});

test(".url and video imports remain ordinary filesystem file resources", async () => {
  const fs = new RecordingFs();
  const shortcut = await importFileIntoFs(
    fs,
    "dir",
    source("Demo.url", "text/plain", new TextEncoder().encode("[InternetShortcut]\nURL=https://example.com\n")),
  );
  const video = await importFileIntoFs(fs, "dir", source("Movie.webm", "video/webm", new Uint8Array([9, 8, 7])));
  expect({ name: shortcut.name, kind: shortcut.kind, mime: shortcut.mime }).toEqual({ name: "Demo.url", kind: "file", mime: "text/plain" });
  expect({ name: video.name, kind: video.kind, mime: video.mime }).toEqual({ name: "Movie.webm", kind: "file", mime: "video/webm" });
});

test("entry pointer cancellation never becomes a drop and preserves coherent selection", () => {
  const ids = ["a", "b"];
  let selection = selectNode(emptySelection(), ids, "a");
  selection = selectNode(selection, ids, "b", { additive: true });
  const outcome = finishEntryDragGesture(
    { ids, moved: true, releaseSelection: null },
    selection,
    true,
  );
  expect(outcome.shouldDrop).toBe(false);
  expect(outcome.ids).toEqual([]);
  expect([...outcome.selection.ids]).toEqual(["a", "b"]);
});
