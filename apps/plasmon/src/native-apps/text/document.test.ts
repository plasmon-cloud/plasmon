import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  FsNode,
  FsReadRange,
  FsService,
  NodeId,
  Revision,
  WriteOptions,
} from "../../os/contracts/index.ts";
import { DocumentSession } from "./document.ts";

class TinyFs implements FsService {
  private rev = 0n;
  private sequence = 0;
  private readonly nodes = new Map<string, FsNode>();
  private readonly bytes = new Map<string, Uint8Array>();
  failWrites = false;

  constructor() {
    this.nodes.set("root", {
      id: "root",
      parentId: null,
      name: "",
      kind: "directory",
      size: 0,
      createdAt: 0,
      modifiedAt: 0,
      metadata: {},
    });
  }

  seed(name: string, text: string): string {
    const id = `n${++this.sequence}`;
    const data = new TextEncoder().encode(text);
    this.nodes.set(id, {
      id,
      parentId: "root",
      name,
      kind: "file",
      mime: name.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain",
      size: data.length,
      contentHash: `h:${text}`,
      createdAt: this.sequence,
      modifiedAt: this.sequence,
      metadata: {},
    });
    this.bytes.set(id, data);
    this.rev += 1n;
    return id;
  }

  async stat(id: NodeId) {
    const node = this.nodes.get(id);
    if (!node) throw new Error("missing");
    return { ...node, metadata: { ...node.metadata } };
  }

  async resolvePath() { return null; }
  async pathOf(id: NodeId) { return `/${(await this.stat(id)).name}`; }

  async list(parentId: NodeId) {
    return [...this.nodes.values()]
      .filter((node) => node.parentId === parentId)
      .map((node) => ({ ...node, metadata: { ...node.metadata } }));
  }

  async mkdir(parentId: NodeId, name: string) {
    return this.createFile(parentId, name, { kind: "file" });
  }

  async createFile(parentId: NodeId, name: string, options: CreateFileOptions = {}) {
    const id = this.seed(name, "");
    const node = this.nodes.get(id)!;
    this.nodes.set(id, {
      ...node,
      parentId,
      kind: options.kind ?? "file",
      ...(options.mime ? { mime: options.mime } : {}),
    });
    return this.stat(id);
  }

  async read(id: NodeId, range?: FsReadRange) {
    const data = (this.bytes.get(id) ?? new Uint8Array()).slice();
    return range ? data.slice(range.offset, range.offset + range.length) : data;
  }

  async write(id: NodeId, data: Uint8Array, _options?: WriteOptions) {
    if (this.failWrites) throw new Error("disk full");
    const node = await this.stat(id);
    const text = new TextDecoder().decode(data);
    this.bytes.set(id, data.slice());
    this.rev += 1n;
    const changed = {
      ...node,
      size: data.length,
      contentHash: `h:${text}`,
      modifiedAt: node.modifiedAt + 1,
    };
    this.nodes.set(id, changed);
    return this.stat(id);
  }

  async rename(id: NodeId, newName: string) {
    const node = await this.stat(id);
    this.nodes.set(id, { ...node, name: newName });
    this.rev += 1n;
    return this.stat(id);
  }

  async move(id: NodeId, newParentId: NodeId) {
    const node = await this.stat(id);
    this.nodes.set(id, { ...node, parentId: newParentId });
    this.rev += 1n;
    return this.stat(id);
  }

  async copy(id: NodeId, parentId: NodeId, name?: string) {
    const node = await this.stat(id);
    const created = await this.createFile(parentId, name ?? node.name, { mime: node.mime });
    await this.write(created.id, await this.read(id), { truncate: true });
    return this.stat(created.id);
  }

  async remove(id: NodeId) {
    this.nodes.delete(id);
    this.bytes.delete(id);
    this.rev += 1n;
  }

  async setMetadata(id: NodeId) { return this.stat(id); }
  async revision(): Promise<Revision> { return this.rev; }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("text session loads and saves UTF-8 content", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "hello");
  const session = new DocumentSession(fs, { autosaveMs: 1000 });
  await session.setTarget(id);
  expect(session.snapshot().text).toBe("hello");
  session.edit("héllo world");
  expect(await session.save()).toBe(true);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("héllo world");
  session.dispose();
});

test("Text save is visible to a newly reopened document session", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "before");
  const first = new DocumentSession(fs);
  await first.setTarget(id);
  first.edit("persisted text");
  expect(await first.save()).toBe(true);
  first.dispose();

  const reopened = new DocumentSession(fs);
  await reopened.setTarget(id);
  expect(reopened.snapshot().text).toBe("persisted text");
  reopened.dispose();
});

test("Markdown save is visible to a newly reopened document session", async () => {
  const fs = new TinyFs();
  const id = fs.seed("README.md", "# Before");
  const first = new DocumentSession(fs);
  await first.setTarget(id);
  first.edit("# After\n\n| A | B |\n| - | - |\n| 1 | 2 |");
  expect(await first.save()).toBe(true);
  first.dispose();

  const reopened = new DocumentSession(fs);
  await reopened.setTarget(id);
  expect(reopened.snapshot().text).toContain("# After");
  expect(reopened.snapshot().text).toContain("| 1 | 2 |");
  reopened.dispose();
});

test("Save As creates a new node and preserves the original", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "original");
  const session = new DocumentSession(fs);
  await session.setTarget(id);
  session.edit("copy text");
  const copy = await session.saveAs("copy.txt");
  expect(copy.id).not.toBe(id);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("original");
  expect(new TextDecoder().decode(await fs.read(copy.id))).toBe("copy text");
  session.dispose();
});

test("target switching cancels stale autosave", async () => {
  const fs = new TinyFs();
  const first = fs.seed("one.txt", "one");
  const second = fs.seed("two.txt", "two");
  const session = new DocumentSession(fs, { autosaveMs: 20 });
  await session.setTarget(first);
  session.edit("changed one");
  await session.setTarget(second);
  await delay(40);
  expect(new TextDecoder().decode(await fs.read(first))).toBe("one");
  expect(session.snapshot().nodeId).toBe(second);
  session.dispose();
});

test("save failure remains visible and dirty", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "a");
  const session = new DocumentSession(fs);
  await session.setTarget(id);
  session.edit("b");
  fs.failWrites = true;
  expect(await session.save()).toBe(false);
  expect(session.snapshot().dirty).toBe(true);
  expect(session.snapshot().error).toContain("disk full");
  session.dispose();
});

test("external revision conflict does not overwrite newer bytes", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "base");
  const session = new DocumentSession(fs);
  await session.setTarget(id);
  session.edit("mine");
  await fs.write(id, new TextEncoder().encode("external"), { truncate: true });
  expect(await session.checkExternalChange()).toBe(true);
  expect(session.snapshot().status).toBe("conflict");
  expect(await session.save()).toBe(false);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("external");
  session.dispose();
});

test("dispose flushes a pending dirty autosave without stale timer writes", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "before");
  const session = new DocumentSession(fs, { autosaveMs: 1000 });
  await session.setTarget(id);
  session.edit("after");
  session.dispose({ flush: true });
  await delay(20);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("after");
});

test("pending close decision suspends autosave until Cancel resumes it", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "before");
  const session = new DocumentSession(fs, { autosaveMs: 15 });
  await session.setTarget(id);
  session.edit("after");
  session.suspendAutosave();
  await delay(30);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("before");

  session.resumeAutosave();
  await delay(30);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("after");
  session.dispose();
});

test("Discard suppresses pending autosave and dispose flush", async () => {
  const fs = new TinyFs();
  const id = fs.seed("notes.txt", "before");
  const session = new DocumentSession(fs, { autosaveMs: 15 });
  await session.setTarget(id);
  session.edit("discard me");
  session.suspendAutosave();
  session.discardOnClose();
  session.dispose({ flush: true });
  await delay(30);
  expect(new TextDecoder().decode(await fs.read(id))).toBe("before");
});
