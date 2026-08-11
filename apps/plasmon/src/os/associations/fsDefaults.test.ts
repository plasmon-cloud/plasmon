import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  HandlerDefinition,
  JsonValue,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import { FsServiceAssociationDefaultStore, FS_ASSOCIATION_DEFAULTS_METADATA_KEY } from "./fsDefaults.ts";
import { HandlerAssociationRegistry } from "./registry.ts";

function copyNode(node: FsNode): FsNode {
  return { ...node, metadata: structuredClone(node.metadata) };
}

class AssociationDefaultsFakeFs implements FsService {
  private root: FsNode | null;
  private rev = 0n;
  failNextMetadataWrites = 0;
  metadataWriteDelayMs = 0;

  constructor(metadata: Record<string, JsonValue> = {}, kind: FsNode["kind"] = "directory") {
    this.root = {
      id: "root",
      parentId: null,
      name: "",
      kind,
      size: 0,
      createdAt: 1,
      modifiedAt: 1,
      metadata: structuredClone(metadata),
    };
  }

  removeRoot(): void {
    this.root = null;
  }

  rootMetadata(): Record<string, JsonValue> {
    if (!this.root) throw new Error("root missing");
    return structuredClone(this.root.metadata);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    return path === "/" && this.root ? copyNode(this.root) : null;
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    if (!this.root || id !== this.root.id) throw new Error(`Unknown node: ${id}`);
    if (this.metadataWriteDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.metadataWriteDelayMs));
    if (this.failNextMetadataWrites > 0) {
      this.failNextMetadataWrites -= 1;
      throw new Error("injected metadata write failure");
    }
    const metadata = { ...this.root.metadata };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete metadata[key];
      else metadata[key] = structuredClone(value);
    }
    this.rev += 1n;
    this.root = { ...this.root, metadata, modifiedAt: this.root.modifiedAt + 1 };
    return copyNode(this.root);
  }

  async stat(id: NodeId): Promise<FsNode> {
    if (!this.root || id !== this.root.id) throw new Error(`Unknown node: ${id}`);
    return copyNode(this.root);
  }
  async pathOf(): Promise<string> { throw new Error("unused"); }
  async list(_parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> { throw new Error("unused"); }
  async mkdir(): Promise<FsNode> { throw new Error("unused"); }
  async createFile(_parentId: NodeId, _name: string, _options?: CreateFileOptions): Promise<FsNode> { throw new Error("unused"); }
  async read(_id: NodeId, _range?: FsReadRange): Promise<Uint8Array> { throw new Error("unused"); }
  async write(_id: NodeId, _bytes: Uint8Array, _options?: WriteOptions): Promise<FsNode> { throw new Error("unused"); }
  async rename(): Promise<FsNode> { throw new Error("unused"); }
  async move(): Promise<FsNode> { throw new Error("unused"); }
  async copy(): Promise<FsNode> { throw new Error("unused"); }
  async remove(): Promise<void> { throw new Error("unused"); }
  async revision(): Promise<Revision> { return this.rev; }
}

const metadataKey = FS_ASSOCIATION_DEFAULTS_METADATA_KEY;

function persisted(defaults: Record<string, string>): JsonValue {
  return { version: 1, defaults };
}

function handler(id: string): HandlerDefinition {
  return { id, kind: "native", name: id, icon: "system:test", capabilities: ["read"] };
}

test("FsService defaults return null when root metadata is missing", async () => {
  const store = new FsServiceAssociationDefaultStore(new AssociationDefaultsFakeFs());
  expect(await store.get("extension:.txt")).toBeNull();
});

test("FsService defaults load existing valid metadata", async () => {
  const fs = new AssociationDefaultsFakeFs({
    [metadataKey]: persisted({ "extension:.txt": "native:text", "mime:image/png": "native:photos" }),
  });
  const store = new FsServiceAssociationDefaultStore(fs);
  expect(await store.get("extension:.txt")).toBe("native:text");
  expect(await store.get("mime:image/png")).toBe("native:photos");
});

test("FsService defaults persist an extension default", async () => {
  const fs = new AssociationDefaultsFakeFs();
  await new FsServiceAssociationDefaultStore(fs).set("extension:.txt", "native:text");
  expect(fs.rootMetadata()[metadataKey]).toEqual(persisted({ "extension:.txt": "native:text" }));
});

test("FsService defaults persist a MIME default", async () => {
  const fs = new AssociationDefaultsFakeFs();
  await new FsServiceAssociationDefaultStore(fs).set("mime:image/png", "native:photos");
  expect(fs.rootMetadata()[metadataKey]).toEqual(persisted({ "mime:image/png": "native:photos" }));
});

test("FsService defaults delete only the requested key", async () => {
  const fs = new AssociationDefaultsFakeFs({
    [metadataKey]: persisted({ "extension:.txt": "native:text", "extension:.md": "native:markdown" }),
  });
  const store = new FsServiceAssociationDefaultStore(fs);
  await store.delete("extension:.txt");
  expect(await store.get("extension:.txt")).toBeNull();
  expect(await store.get("extension:.md")).toBe("native:markdown");
  expect(fs.rootMetadata()[metadataKey]).toEqual(persisted({ "extension:.md": "native:markdown" }));
});

test("FsService defaults treat corrupt metadata as empty", async () => {
  const corruptValues = [
    7,
    { version: 2, defaults: { "extension:.txt": "native:text" } },
    { version: 1, defaults: ["native:text"] },
    { version: 1, defaults: { "extension:.txt": 17 } },
  ] as unknown as JsonValue[];
  for (const value of corruptValues) {
    const fs = new AssociationDefaultsFakeFs({ [metadataKey]: value });
    expect(await new FsServiceAssociationDefaultStore(fs).get("extension:.txt")).toBeNull();
  }
});

test("FsService defaults reload in a new store instance", async () => {
  const fs = new AssociationDefaultsFakeFs();
  const first = new FsServiceAssociationDefaultStore(fs);
  await first.set("extension:.md", "native:text");
  const second = new FsServiceAssociationDefaultStore(fs);
  expect(await second.get("extension:.md")).toBe("native:text");
});

test("FsService defaults serialize rapid different writes without losing either", async () => {
  const fs = new AssociationDefaultsFakeFs();
  fs.metadataWriteDelayMs = 5;
  const store = new FsServiceAssociationDefaultStore(fs);
  await Promise.all([
    store.set("extension:.txt", "native:text"),
    store.set("mime:image/png", "native:photos"),
  ]);
  const reconstructed = new FsServiceAssociationDefaultStore(fs);
  expect(await reconstructed.get("extension:.txt")).toBe("native:text");
  expect(await reconstructed.get("mime:image/png")).toBe("native:photos");
});

test("FsService defaults recover after a failed write", async () => {
  const fs = new AssociationDefaultsFakeFs();
  const store = new FsServiceAssociationDefaultStore(fs);
  fs.failNextMetadataWrites = 1;
  await expect(store.set("extension:.txt", "native:text")).rejects.toThrow("injected metadata write failure");
  await store.set("extension:.md", "native:markdown");
  const reconstructed = new FsServiceAssociationDefaultStore(fs);
  expect(await reconstructed.get("extension:.txt")).toBeNull();
  expect(await reconstructed.get("extension:.md")).toBe("native:markdown");
});

test("FsService defaults preserve unrelated root metadata", async () => {
  const fs = new AssociationDefaultsFakeFs({ owner: "keep", shell: { theme: "dark" } });
  await new FsServiceAssociationDefaultStore(fs).set("extension:.txt", "native:text");
  expect(fs.rootMetadata().owner).toBe("keep");
  expect(fs.rootMetadata().shell).toEqual({ theme: "dark" });
});

test("FsService default store has no direct localStorage dependency", async () => {
  const source = await Bun.file(new URL("./fsDefaults.ts", import.meta.url)).text();
  expect(source).not.toContain("localStorage");
});

test("FsService defaults require a directory filesystem root", async () => {
  const fileRoot = new FsServiceAssociationDefaultStore(new AssociationDefaultsFakeFs({}, "file"));
  await expect(fileRoot.get("extension:.txt")).rejects.toThrow("root must be a directory");

  const missingFs = new AssociationDefaultsFakeFs();
  missingFs.removeRoot();
  await expect(new FsServiceAssociationDefaultStore(missingFs).get("extension:.txt")).rejects.toThrow("root is unavailable");
});

test("HandlerAssociationRegistry honors FsService default after reconstruction", async () => {
  const fs = new AssociationDefaultsFakeFs();
  const firstStore = new FsServiceAssociationDefaultStore(fs);
  const firstRegistry = new HandlerAssociationRegistry({ defaults: firstStore });
  for (const id of ["native:preferred", "native:other"]) firstRegistry.registerHandler(handler(id));
  firstRegistry.registerRule({ id: "preferred", handlerId: "native:preferred", extensions: [".md"], priority: 1 });
  firstRegistry.registerRule({ id: "other", handlerId: "native:other", extensions: [".md"], priority: 100 });
  await firstRegistry.setUserDefault("extension:.md", "native:preferred");

  const secondStore = new FsServiceAssociationDefaultStore(fs);
  const secondRegistry = new HandlerAssociationRegistry({ defaults: secondStore });
  for (const id of ["native:preferred", "native:other"]) secondRegistry.registerHandler(handler(id));
  secondRegistry.registerRule({ id: "preferred", handlerId: "native:preferred", extensions: [".md"], priority: 1 });
  secondRegistry.registerRule({ id: "other", handlerId: "native:other", extensions: [".md"], priority: 100 });

  const document: FsNode = {
    id: "node:md",
    parentId: "root",
    name: "README.md",
    kind: "file",
    mime: "text/markdown",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
  expect((await secondRegistry.resolve(document))[0]?.id).toBe("native:preferred");
});
