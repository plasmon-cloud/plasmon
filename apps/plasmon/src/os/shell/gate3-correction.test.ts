// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  JsonValue,
  NativeAppDefinition,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import { searchShell } from "./search.ts";
import { START_MENU_PATH, listStartMenuFolder, reconcileStartMenu } from "./startMenu.ts";

class CorrectionFs implements FsService {
  private readonly nodes = new Map<NodeId, FsNode>();
  private nextId = 1;
  private tick = 1;

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

  async stat(id: NodeId): Promise<FsNode> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`missing node ${id}`);
    return this.clone(node);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    if (path === "/") return this.stat("root");
    let current = this.nodes.get("root");
    if (!current) return null;
    for (const part of path.split("/").filter(Boolean)) {
      const child = [...this.nodes.values()].find((node) => node.parentId === current!.id && node.name === part);
      if (!child) return null;
      current = child;
    }
    return this.clone(current);
  }

  async pathOf(id: NodeId): Promise<string> {
    const parts: string[] = [];
    let node = this.nodes.get(id);
    if (!node) throw new Error(`missing node ${id}`);
    while (node.parentId) {
      parts.unshift(node.name);
      node = this.nodes.get(node.parentId);
      if (!node) throw new Error("broken parent");
    }
    return `/${parts.join("/")}`;
  }

  async list(parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> {
    return [...this.nodes.values()]
      .filter((node) => node.parentId === parentId)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((node) => this.clone(node));
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
    return this.clone(node);
  }
  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const node = this.require(id);
    node.name = newName;
    node.modifiedAt = ++this.tick;
    return this.clone(node);
  }
  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const node = this.require(id);
    node.parentId = newParentId;
    node.modifiedAt = ++this.tick;
    return this.clone(node);
  }
  async copy(): Promise<FsNode> { throw new Error("unused"); }
  async remove(id: NodeId): Promise<void> { this.nodes.delete(id); }
  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    const node = this.require(id);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete node.metadata[key];
      else node.metadata[key] = structuredClone(value);
    }
    node.modifiedAt = ++this.tick;
    return this.clone(node);
  }
  async revision(): Promise<Revision> { return BigInt(this.tick); }

  private create(
    parentId: NodeId,
    name: string,
    kind: FsNode["kind"],
    metadata: Record<string, JsonValue>,
    mime?: string,
  ): FsNode {
    if (!this.nodes.has(parentId)) throw new Error(`missing parent ${parentId}`);
    if ([...this.nodes.values()].some((node) => node.parentId === parentId && node.name === name)) {
      throw new Error(`duplicate ${name}`);
    }
    const id = `n${this.nextId++}`;
    const node: FsNode = {
      id,
      parentId,
      name,
      kind,
      size: 0,
      ...(mime ? { mime } : {}),
      createdAt: ++this.tick,
      modifiedAt: this.tick,
      metadata: structuredClone(metadata),
    };
    this.nodes.set(id, node);
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
}

function namedApp(index: number): NativeAppDefinition {
  return {
    id: `native:name-${index}`,
    handlerId: `native:name-${index}`,
    name: "Name",
    icon: "N",
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

test("Start collision suffixes progress Name, Name (1), Name (2)", async () => {
  const fs = new CorrectionFs();
  const { root } = await reconcileStartMenu(fs, [namedApp(0), namedApp(1), namedApp(2)], []);
  expect(await fs.pathOf(root.id)).toBe(START_MENU_PATH);
  const accessories = (await listStartMenuFolder(fs, root.id)).find((node) => node.name === "Accessories");
  expect(accessories?.kind).toBe("directory");
  expect((await listStartMenuFolder(fs, accessories!.id)).map((node) => node.name)).toEqual([
    "Name",
    "Name (1)",
    "Name (2)",
  ]);
});

test("non-empty Search returns matching folders, omits unrelated folders, and preserves file categories", async () => {
  const fs = new CorrectionFs();
  await fs.mkdir("root", "Project Notes");
  await fs.mkdir("root", "Archive");
  await fs.createFile("root", "project.txt", { mime: "text/plain" });
  await fs.createFile("root", "project.md", { mime: "text/markdown" });
  await fs.createFile("root", "project.png", { mime: "image/png" });
  await fs.createFile("root", "project.atom", { kind: "atom" });

  const batch = await searchShell(fs, [], [], "project");
  expect(batch.results.some((result) => result.kind === "directory" && result.title === "Project Notes" && result.subtitle === "Folder")).toBe(true);
  expect(batch.results.some((result) => result.kind === "directory" && result.title === "Archive")).toBe(false);
  expect(batch.results.some((result) => result.kind === "file" && result.title === "project.txt" && result.category === "documents")).toBe(true);
  expect(batch.results.some((result) => result.kind === "file" && result.title === "project.md" && result.category === "documents")).toBe(true);
  expect(batch.results.some((result) => result.kind === "file" && result.title === "project.png" && result.category === "media")).toBe(true);
  expect(batch.results.some((result) => result.kind === "file" && result.title === "project.atom" && result.category === "atoms")).toBe(true);
});