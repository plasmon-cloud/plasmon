import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  FsNode,
  FsReadRange,
  FsService,
  WriteOptions,
} from "../contracts/fs.ts";
import type { JsonValue, NodeId, Revision } from "../contracts/common.ts";
import type { ResourceRef } from "../contracts/authorization.ts";
import {
  ChunkIntegrityError,
  InvalidPublishedResourceError,
  MemorySharedResourceStore,
  PLASMON_ATOM_NAMESPACE,
  ProviderSchemaVersionError,
  RevisionConflictError,
  StableSharedResourceProvider,
  SHARING_PROVIDER_ID,
  createMemorySharedResourceState,
  type SharedResourceStore,
} from "./index.ts";

class TestFs implements FsService {
  readonly rootId = "root";
  private revisionValue = 0n;
  private nextId = 1;
  private readonly nodes = new Map<NodeId, FsNode>();
  private readonly contents = new Map<NodeId, Uint8Array>();

  constructor() {
    const now = Date.now();
    this.nodes.set(this.rootId, {
      id: this.rootId,
      parentId: null,
      name: "",
      kind: "directory",
      size: 0,
      createdAt: now,
      modifiedAt: now,
      metadata: {},
    });
  }

  private clone(node: FsNode): FsNode {
    return { ...node, metadata: structuredClone(node.metadata) };
  }

  async stat(id: NodeId): Promise<FsNode> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`missing node ${id}`);
    return this.clone(node);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    if (path === "/") return this.stat(this.rootId);
    let id = this.rootId;
    for (const name of path.split("/").filter(Boolean)) {
      const child = [...this.nodes.values()].find((node) => node.parentId === id && node.name === name);
      if (!child) return null;
      id = child.id;
    }
    return this.stat(id);
  }

  async pathOf(id: NodeId): Promise<string> {
    const parts: string[] = [];
    let node = await this.stat(id);
    while (node.parentId !== null) {
      parts.unshift(node.name);
      node = await this.stat(node.parentId);
    }
    return `/${parts.join("/")}`;
  }

  async list(parentId: NodeId): Promise<FsNode[]> {
    await this.stat(parentId);
    return [...this.nodes.values()].filter((node) => node.parentId === parentId).map((node) => this.clone(node));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    const now = Date.now();
    await this.stat(parentId);
    const node: FsNode = {
      id: `node:${this.nextId++}`,
      parentId,
      name,
      kind: "directory",
      size: 0,
      createdAt: now,
      modifiedAt: now,
      metadata: {},
    };
    this.nodes.set(node.id, node);
    this.revisionValue += 1n;
    return this.stat(node.id);
  }

  async createFile(parentId: NodeId, name: string, options: CreateFileOptions = {}): Promise<FsNode> {
    const parent = await this.stat(parentId);
    if (parent.kind !== "directory") throw new Error("parent not directory");
    if ((await this.list(parentId)).some((node) => node.name === name)) throw new Error("name collision");
    const now = Date.now();
    const node: FsNode = {
      id: `node:${this.nextId++}`,
      parentId,
      name,
      kind: options.kind ?? "file",
      ...(options.mime ? { mime: options.mime } : {}),
      size: 0,
      createdAt: now,
      modifiedAt: now,
      metadata: structuredClone(options.metadata ?? {}),
    };
    this.nodes.set(node.id, node);
    this.contents.set(node.id, new Uint8Array());
    this.revisionValue += 1n;
    return this.stat(node.id);
  }

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    await this.stat(id);
    const bytes = this.contents.get(id) ?? new Uint8Array();
    return range ? bytes.slice(range.offset, range.offset + range.length) : bytes.slice();
  }

  async write(id: NodeId, bytes: Uint8Array, options: WriteOptions = {}): Promise<FsNode> {
    const node = await this.stat(id);
    const old = this.contents.get(id) ?? new Uint8Array();
    const offset = options.offset ?? 0;
    const end = offset + bytes.length;
    const length = options.truncate ? end : Math.max(old.length, end);
    const next = new Uint8Array(length);
    next.set(old.slice(0, length));
    next.set(bytes, offset);
    this.contents.set(id, next);
    this.nodes.set(id, { ...node, size: next.length, modifiedAt: Date.now() });
    this.revisionValue += 1n;
    return this.stat(id);
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const node = await this.stat(id);
    this.nodes.set(id, { ...node, name: newName, modifiedAt: Date.now() });
    this.revisionValue += 1n;
    return this.stat(id);
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const node = await this.stat(id);
    await this.stat(newParentId);
    this.nodes.set(id, { ...node, parentId: newParentId, modifiedAt: Date.now() });
    this.revisionValue += 1n;
    return this.stat(id);
  }

  async copy(id: NodeId, newParentId: NodeId, name?: string): Promise<FsNode> {
    const source = await this.stat(id);
    if (source.kind === "directory") throw new Error("test copy directory unsupported");
    const copy = await this.createFile(newParentId, name ?? source.name, {
      kind: source.kind,
      mime: source.mime,
      metadata: source.metadata,
    });
    await this.write(copy.id, await this.read(id), { truncate: true });
    return this.stat(copy.id);
  }

  async remove(id: NodeId): Promise<void> {
    this.nodes.delete(id);
    this.contents.delete(id);
    this.revisionValue += 1n;
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    const node = await this.stat(id);
    const metadata = structuredClone(node.metadata);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete metadata[key];
      else metadata[key] = value;
    }
    this.nodes.set(id, { ...node, metadata, modifiedAt: Date.now() });
    this.revisionValue += 1n;
    return this.stat(id);
  }

  async revision(): Promise<Revision> {
    return this.revisionValue;
  }
}

function atomMetadata(atomId = "atom-123"): Record<string, JsonValue> {
  return {
    atom: {
      format: "plasmon.atom",
      version: 1,
      atomId,
      handlerId: "neutron:notepad2",
      atomType: "notepad2/v1",
      schemaVersion: 1,
      title: "Story",
      metadata: {
        secret: "authorization-material-must-not-be-published",
        token: "also-must-not-be-published",
      },
    },
  };
}

async function makeAtom(fs: TestFs, parent: NodeId, bytes: Uint8Array, atomId = "atom-123") {
  const node = await fs.createFile(parent, `${atomId}.notepad2.atom`, {
    kind: "atom",
    mime: "application/x-plasmon-atom",
    metadata: atomMetadata(atomId),
  });
  await fs.write(node.id, bytes, { truncate: true });
  return fs.stat(node.id);
}

class CorruptingStore implements SharedResourceStore {
  constructor(private readonly inner: SharedResourceStore) {}
  schemaVersion() { return this.inner.schemaVersion(); }
  hasChunk(hash: string) { return this.inner.hasChunk(hash); }
  putChunk(hash: string, bytes: Uint8Array) { return this.inner.putChunk(hash, bytes); }
  async getChunk(hash: string) {
    const bytes = await this.inner.getChunk(hash);
    if (!bytes || bytes.length === 0) return bytes;
    const corrupt = bytes.slice();
    corrupt[0] ^= 0xff;
    return corrupt;
  }
  describe(identity: Parameters<SharedResourceStore["describe"]>[0]) { return this.inner.describe(identity); }
  getRevision(identity: Parameters<SharedResourceStore["getRevision"]>[0], revision?: string) { return this.inner.getRevision(identity, revision); }
  commitRevision(request: Parameters<SharedResourceStore["commitRevision"]>[0]) { return this.inner.commitRevision(request); }
}

test("first publication creates a stable Atom resource at revision 1", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("hello"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 4, now: () => 1000 });

  const published = await provider.publish(atom.id);
  expect(published.resource.providerId).toBe(SHARING_PROVIDER_ID);
  expect(published.resource.resourceId).toBe("atom-123");
  expect(published.resource.revision).toBe("1");
  expect(published.resource.metadata?.namespace).toBe(PLASMON_ATOM_NAMESPACE);
  expect(store.stats()).toEqual({ resourceCount: 1, revisionCount: 1, chunkCount: 2, totalChunkBytes: 5 });
});

test("repeat publication creates a revision while deduplicating unchanged chunks", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("abcdefgh"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 4 });

  const first = await provider.publish(atom.id);
  const firstStats = store.stats();
  const second = await provider.publish(atom.id);

  expect(first.resource.revision).toBe("1");
  expect(second.resource.revision).toBe("2");
  expect(store.stats().chunkCount).toBe(firstStats.chunkCount);
  expect(store.stats().revisionCount).toBe(2);
});

test("identical content is deduplicated across distinct published resources", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const bytes = new TextEncoder().encode("same chunk bytes");
  const first = await makeAtom(fs, docs.id, bytes, "atom-one");
  const second = await makeAtom(fs, docs.id, bytes, "atom-two");
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 5 });

  await provider.publish(first.id);
  const afterFirst = store.stats().chunkCount;
  await provider.publish(second.id);

  expect(store.stats().resourceCount).toBe(2);
  expect(store.stats().chunkCount).toBe(afterFirst);
});

test("multi-chunk publication never stores a giant resource value", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const bytes = Uint8Array.from({ length: 25 }, (_, index) => index);
  const atom = await makeAtom(fs, docs.id, bytes);
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 8 });

  await provider.publish(atom.id);
  expect(store.stats().chunkCount).toBe(4);
  expect(store.stats().totalChunkBytes).toBe(25);
});

test("rename and move do not change published Atom identity", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const archive = await fs.mkdir(fs.rootId, "Archive");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("same identity"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 5 });

  const first = await provider.publish(atom.id);
  await fs.rename(atom.id, "renamed.notepad2.atom");
  await fs.move(atom.id, archive.id);
  const second = await provider.publish(atom.id);

  expect(first.resource.resourceId).toBe("atom-123");
  expect(second.resource.resourceId).toBe("atom-123");
  expect(second.resource.revision).toBe("2");
  expect((await provider.describePublished(second.resource)).revision.snapshot.displayName).toBe("renamed.notepad2.atom");
});

test("resource-scoped write succeeds at expected revision and rejects stale revision", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("v1"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store);
  const published = await provider.publish(atom.id);
  const resource = provider.openInternalResource(published.resource);

  const written = await resource.write("1", new TextEncoder().encode("v2"), 2000);
  expect(written.revision).toBe("2");
  expect(new TextDecoder().decode(await resource.readAll("2"))).toBe("v2");
  await expect(resource.write("1", new TextEncoder().encode("stale"))).rejects.toBeInstanceOf(RevisionConflictError);
});

test("chunk integrity failure is rejected during import", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const incoming = await fs.mkdir(fs.rootId, "Incoming");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("integrity"));
  const store = new MemorySharedResourceStore();
  const publisher = new StableSharedResourceProvider(fs, store, { chunkSize: 4 });
  const published = await publisher.publish(atom.id);
  const corruptProvider = new StableSharedResourceProvider(fs, new CorruptingStore(store), { chunkSize: 4 });

  await expect(corruptProvider.importResource(published.resource, incoming.id)).rejects.toBeInstanceOf(ChunkIntegrityError);
});

test("provider state survives store recreation with schema version enforced", async () => {
  const state = createMemorySharedResourceState();
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("persistent"));
  const firstStore = new MemorySharedResourceStore(state);
  const firstProvider = new StableSharedResourceProvider(fs, firstStore);
  const published = await firstProvider.publish(atom.id);

  const restarted = new StableSharedResourceProvider(fs, new MemorySharedResourceStore(state));
  expect((await restarted.describePublished(published.resource)).revision.revision).toBe("1");

  const incompatible = createMemorySharedResourceState();
  incompatible.schemaVersion = 2;
  expect(() => new MemorySharedResourceStore(incompatible)).toThrow(ProviderSchemaVersionError);
});

test("import creates new local node and Atom identity while retaining provider provenance", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const incoming = await fs.mkdir(fs.rootId, "Incoming");
  const original = await makeAtom(fs, docs.id, new TextEncoder().encode("copy me"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 3 });
  const published = await provider.publish(original.id);

  const imported = await provider.importResource(published.resource, incoming.id);
  const localAtom = imported.metadata.atom as { [key: string]: JsonValue };
  const sharedSource = imported.metadata.sharedSource as { [key: string]: JsonValue };

  expect(imported.id).not.toBe(original.id);
  expect(localAtom.atomId).not.toBe("atom-123");
  expect(sharedSource.resourceId).toBe("atom-123");
  expect(new TextDecoder().decode(await fs.read(imported.id))).toBe("copy me");
});

test("malformed provisional ResourceRef values fail at the narrow boundary", async () => {
  const fs = new TestFs();
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store);
  const invalid: ResourceRef = {
    providerId: "caller-selected-provider",
    resourceId: "atom-123",
    revision: "1",
    metadata: { namespace: PLASMON_ATOM_NAMESPACE, resourceType: "notepad2/v1", providerSchemaVersion: 1 },
  };

  await expect(provider.describePublished(invalid)).rejects.toBeInstanceOf(InvalidPublishedResourceError);
  expect(() => provider.openInternalResource({ ...invalid, providerId: SHARING_PROVIDER_ID, revision: "0" })).toThrow(InvalidPublishedResourceError);
});

test("provider persistence contains no bearer capability or authorization material", async () => {
  const fs = new TestFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, new TextEncoder().encode("safe"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store);
  await provider.publish(atom.id);

  const serialized = JSON.stringify(store.exportSerializableState()).toLowerCase();
  for (const forbidden of ["bearer", "capability", "authorization", "grant", "lease", "rights", "secret", "token"]) {
    expect(serialized).not.toContain(forbidden);
  }
});
