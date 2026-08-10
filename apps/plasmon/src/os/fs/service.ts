import type {
  CreateFileOptions,
  FsEvent,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  WriteOptions,
} from "../contracts/fs.ts";
import type { JsonValue, NodeId, Revision } from "../contracts/common.ts";
import {
  FS_SCHEMA_VERSION,
  STORAGE_CHUNK_BYTES,
  type ChunkDelete,
  type ChunkWrite,
  type FsRepository,
  type RepositoryState,
  type StoredBlob,
  type StoredNode,
} from "./repository.ts";

const ROOT_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_DIRECTORIES = ["Desktop", "Documents", "Downloads", "Videos", "Pictures", "Shared", "System"] as const;

export interface PersistentFsServiceOptions {
  now?: () => number;
  randomUUID?: () => string;
  onCommit?: (revision: Revision) => void;
}

type MutationResult<T> = {
  value: T;
  nodes: Map<NodeId, StoredNode>;
  blobs: Map<string, StoredBlob>;
  putChunks?: ChunkWrite[];
  deleteChunks?: ChunkDelete[];
  events: FsEvent[];
};

export class PersistentFsService implements FsService, FsEventSource {
  readonly rootId: NodeId = ROOT_ID;
  private readonly now: () => number;
  private readonly randomUUID: () => string;
  private readonly onCommit?: (revision: Revision) => void;
  private readonly listeners = new Set<(event: FsEvent) => void>();
  private nodes = new Map<NodeId, StoredNode>();
  private blobs = new Map<string, StoredBlob>();
  private rev = 0n;
  private mutationTail: Promise<void> = Promise.resolve();
  private readonly ready: Promise<void>;

  constructor(private readonly repository: FsRepository, options: PersistentFsServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
    this.onCommit = options.onCommit;
    this.ready = this.initialize();
  }

  subscribe(listener: (event: FsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async stat(id: NodeId): Promise<FsNode> {
    await this.ready;
    return clonePublicNode(this.requireNode(id));
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    await this.ready;
    if (!path.startsWith("/")) throw new Error("Filesystem paths must be absolute");
    if (path === "/") return clonePublicNode(this.requireNode(this.rootId));
    const parts = path.split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === "..")) {
      throw new Error("Relative path segments are not supported");
    }
    let parentId = this.rootId;
    for (const part of parts) {
      const key = nameKey(part);
      const child = [...this.nodes.values()].find((node) => node.parentId === parentId && node.nameKey === key);
      if (!child) return null;
      parentId = child.id;
    }
    return clonePublicNode(this.requireNode(parentId));
  }

  async pathOf(id: NodeId): Promise<string> {
    await this.ready;
    const node = this.requireNode(id);
    if (node.parentId === null) return "/";
    const parts: string[] = [];
    const seen = new Set<NodeId>();
    let current: StoredNode | undefined = node;
    while (current && current.parentId !== null) {
      if (seen.has(current.id)) throw new Error("Filesystem parent cycle detected");
      seen.add(current.id);
      parts.unshift(current.name);
      current = this.nodes.get(current.parentId);
      if (!current) throw new Error(`Filesystem parent is missing: ${node.id}`);
    }
    return `/${parts.join("/")}`;
  }

  async list(parentId: NodeId, options: FsListOptions = {}): Promise<FsNode[]> {
    await this.ready;
    const parent = this.requireNode(parentId);
    if (parent.kind !== "directory") throw new Error("Cannot list a non-directory node");
    const nodes = [...this.nodes.values()]
      .filter((node) => node.parentId === parentId)
      .filter((node) => options.includeHidden || node.metadata.hidden !== true)
      .map(clonePublicNode);
    sortNodes(nodes, options.sort ?? "name");
    return nodes;
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    return this.mutate(async (nodes, blobs) => {
      this.validateParentAndName(nodes, parentId, name);
      const now = this.now();
      const node = makeNode(this.nextId(), parentId, name, "directory", now, {});
      nodes.set(node.id, node);
      return { value: clonePublicNode(node), nodes, blobs, events: [{ type: "created", node: clonePublicNode(node) }] };
    });
  }

  async createFile(parentId: NodeId, name: string, options: CreateFileOptions = {}): Promise<FsNode> {
    return this.mutate(async (nodes, blobs) => {
      this.validateParentAndName(nodes, parentId, name);
      const now = this.now();
      const node = makeNode(
        this.nextId(),
        parentId,
        name,
        options.kind ?? "file",
        now,
        cloneMetadata(options.metadata ?? {}),
        options.mime,
      );
      nodes.set(node.id, node);
      return { value: clonePublicNode(node), nodes, blobs, events: [{ type: "created", node: clonePublicNode(node) }] };
    });
  }

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    await this.ready;
    const node = this.requireNode(id);
    if (node.kind === "directory") throw new Error("Cannot read a directory");
    const { offset, length } = normalizeRange(node.size, range);
    if (length === 0 || !node.contentHash) return new Uint8Array();
    const first = Math.floor(offset / STORAGE_CHUNK_BYTES);
    const last = Math.floor((offset + length - 1) / STORAGE_CHUNK_BYTES);
    const result = new Uint8Array(length);
    let targetOffset = 0;
    for (let index = first; index <= last; index += 1) {
      const chunk = await this.repository.readChunk(node.contentHash, index);
      if (!chunk) throw new Error(`Filesystem content chunk is missing for ${node.id}`);
      const absoluteStart = index * STORAGE_CHUNK_BYTES;
      const from = Math.max(offset - absoluteStart, 0);
      const to = Math.min(offset + length - absoluteStart, chunk.length);
      if (to > from) {
        const piece = chunk.subarray(from, to);
        result.set(piece, targetOffset);
        targetOffset += piece.length;
      }
    }
    if (targetOffset !== length) throw new Error(`Filesystem content is truncated for ${node.id}`);
    if (!range && node.contentHash && await sha256(result) !== node.contentHash) {
      throw new Error(`Filesystem content hash mismatch for ${node.id}`);
    }
    return result;
  }

  async write(id: NodeId, bytes: Uint8Array, options: WriteOptions = {}): Promise<FsNode> {
    if (!(bytes instanceof Uint8Array)) throw new Error("Filesystem writes require Uint8Array bytes");
    const input = bytes.slice();
    return this.mutate(async (nodes, blobs) => {
      const node = requireNodeFrom(nodes, id);
      if (node.kind === "directory") throw new Error("Cannot write a directory");
      const offset = normalizeOffset(options.offset ?? 0);
      const oldBytes = await this.readContentForNode(node);
      const required = offset + input.length;
      if (!Number.isSafeInteger(required)) throw new Error("Filesystem write is too large");
      const nextLength = options.truncate ? required : Math.max(oldBytes.length, required);
      const nextBytes = new Uint8Array(nextLength);
      nextBytes.set(oldBytes.subarray(0, Math.min(oldBytes.length, nextLength)));
      nextBytes.set(input, offset);
      const hash = await sha256(nextBytes);
      const putChunks: ChunkWrite[] = [];
      const deleteChunks: ChunkDelete[] = [];
      const oldHash = node.contentHash;

      if (oldHash !== hash) {
        const existing = blobs.get(hash);
        if (existing) {
          existing.refCount += 1;
        } else {
          const chunkCount = Math.ceil(nextBytes.length / STORAGE_CHUNK_BYTES);
          blobs.set(hash, { hash, size: nextBytes.length, chunkCount, refCount: 1 });
          for (let index = 0; index < chunkCount; index += 1) {
            putChunks.push({
              hash,
              index,
              bytes: nextBytes.slice(index * STORAGE_CHUNK_BYTES, (index + 1) * STORAGE_CHUNK_BYTES),
            });
          }
        }
        if (oldHash) releaseBlob(blobs, oldHash, deleteChunks);
      }

      const changed: StoredNode = {
        ...node,
        size: nextBytes.length,
        contentHash: hash,
        modifiedAt: this.now(),
        metadata: cloneMetadata(node.metadata),
      };
      nodes.set(id, changed);
      return {
        value: clonePublicNode(changed), nodes, blobs, putChunks, deleteChunks,
        events: [{ type: "changed", node: clonePublicNode(changed) }],
      };
    });
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    return this.mutate(async (nodes, blobs) => {
      const node = requireNodeFrom(nodes, id);
      if (node.parentId === null) throw new Error("Cannot rename filesystem root");
      validateName(newName);
      assertUniqueName(nodes, node.parentId, newName, id);
      const changed = { ...node, name: newName, nameKey: nameKey(newName), modifiedAt: this.now() };
      nodes.set(id, changed);
      return { value: clonePublicNode(changed), nodes, blobs, events: [{ type: "changed", node: clonePublicNode(changed) }] };
    });
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    return this.mutate(async (nodes, blobs) => {
      const node = requireNodeFrom(nodes, id);
      if (node.parentId === null) throw new Error("Cannot move filesystem root");
      const parent = requireNodeFrom(nodes, newParentId);
      if (parent.kind !== "directory") throw new Error("Move destination is not a directory");
      if (node.kind === "directory") assertNotDescendant(nodes, id, newParentId);
      assertUniqueName(nodes, newParentId, node.name, id);
      if (node.parentId === newParentId) {
        return { value: clonePublicNode(node), nodes, blobs, events: [] };
      }
      const oldParentId = node.parentId;
      const changed = { ...node, parentId: newParentId, modifiedAt: this.now() };
      nodes.set(id, changed);
      return {
        value: clonePublicNode(changed), nodes, blobs,
        events: [{ type: "moved", node: clonePublicNode(changed), oldParentId }],
      };
    }, false);
  }

  async copy(id: NodeId, newParentId: NodeId, name?: string): Promise<FsNode> {
    return this.mutate(async (nodes, blobs) => {
      const source = requireNodeFrom(nodes, id);
      const destination = requireNodeFrom(nodes, newParentId);
      if (destination.kind !== "directory") throw new Error("Copy destination is not a directory");
      const rootName = name ?? source.name;
      validateName(rootName);
      assertUniqueName(nodes, newParentId, rootName);
      if (source.kind === "directory") assertNotDescendant(nodes, id, newParentId);
      const events: FsEvent[] = [];
      const copied = this.copyTree(nodes, blobs, source, newParentId, rootName, events);
      return { value: clonePublicNode(copied), nodes, blobs, events };
    });
  }

  async remove(id: NodeId, options: { recursive?: boolean } = {}): Promise<void> {
    return this.mutate(async (nodes, blobs) => {
      const node = requireNodeFrom(nodes, id);
      if (node.parentId === null) throw new Error("Cannot remove filesystem root");
      const children = childrenOf(nodes, id);
      if (children.length > 0 && !options.recursive) throw new Error("Directory is not empty");
      const events: FsEvent[] = [];
      const deleteChunks: ChunkDelete[] = [];
      removeTree(nodes, blobs, node, events, deleteChunks);
      return { value: undefined, nodes, blobs, events, deleteChunks };
    });
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    return this.mutate(async (nodes, blobs) => {
      const node = requireNodeFrom(nodes, id);
      const metadata = cloneMetadata(node.metadata);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete metadata[key];
        else metadata[key] = structuredClone(value);
      }
      const changed = { ...node, metadata, modifiedAt: this.now() };
      nodes.set(id, changed);
      return { value: clonePublicNode(changed), nodes, blobs, events: [{ type: "changed", node: clonePublicNode(changed) }] };
    });
  }

  async revision(): Promise<Revision> {
    await this.ready;
    return this.rev;
  }

  private async initialize(): Promise<void> {
    const stored = await this.repository.load();
    if (stored) {
      if (stored.schemaVersion !== FS_SCHEMA_VERSION) {
        throw new Error(`Unsupported filesystem schema version: ${stored.schemaVersion}`);
      }
      this.nodes = new Map(stored.nodes.map((node) => [node.id, cloneStoredNode(node)]));
      this.blobs = new Map(stored.blobs.map((blob) => [blob.hash, { ...blob }]));
      this.rev = BigInt(stored.revision);
      if (!this.nodes.has(stored.rootId) || stored.rootId !== this.rootId) {
        throw new Error("Filesystem root identity is invalid");
      }
      return;
    }

    const now = this.now();
    const root = makeNode(this.rootId, null, "", "directory", now, {});
    this.nodes.set(root.id, root);
    for (const name of DEFAULT_DIRECTORIES) {
      const metadata: Record<string, JsonValue> = name === "System" ? { hidden: true, system: true } : {};
      const node = makeNode(this.nextId(), root.id, name, "directory", now, metadata);
      this.nodes.set(node.id, node);
    }
    await this.repository.commit({ state: this.snapshotState(this.nodes, this.blobs, 0n) });
  }

  private async mutate<T>(
    operation: (nodes: Map<NodeId, StoredNode>, blobs: Map<string, StoredBlob>) => Promise<MutationResult<T>>,
    commitNoop = true,
  ): Promise<T> {
    await this.ready;
    const pending = this.mutationTail.then(async () => {
      const nodes = cloneNodeMap(this.nodes);
      const blobs = cloneBlobMap(this.blobs);
      const result = await operation(nodes, blobs);
      if (!commitNoop && result.events.length === 0) return result.value;
      const nextRevision = this.rev + 1n;
      await this.repository.commit({
        state: this.snapshotState(result.nodes, result.blobs, nextRevision),
        putChunks: result.putChunks,
        deleteChunks: result.deleteChunks,
      });
      this.nodes = result.nodes;
      this.blobs = result.blobs;
      this.rev = nextRevision;
      try { this.onCommit?.(nextRevision); } catch { /* publication cannot roll back committed storage */ }
      for (const event of result.events) this.emit(event);
      return result.value;
    });
    this.mutationTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private emit(event: FsEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* listeners cannot break committed state */ }
    }
  }

  private requireNode(id: NodeId): StoredNode {
    return requireNodeFrom(this.nodes, id);
  }

  private validateParentAndName(nodes: Map<NodeId, StoredNode>, parentId: NodeId, name: string): void {
    const parent = requireNodeFrom(nodes, parentId);
    if (parent.kind !== "directory") throw new Error("Parent is not a directory");
    validateName(name);
    assertUniqueName(nodes, parentId, name);
  }

  private nextId(): NodeId {
    return this.randomUUID();
  }

  private snapshotState(nodes: Map<NodeId, StoredNode>, blobs: Map<string, StoredBlob>, revision: Revision): RepositoryState {
    return {
      schemaVersion: FS_SCHEMA_VERSION,
      rootId: this.rootId,
      revision: revision.toString(),
      nodes: [...nodes.values()].map(cloneStoredNode),
      blobs: [...blobs.values()].map((blob) => ({ ...blob })),
    };
  }

  private async readContentForNode(node: StoredNode): Promise<Uint8Array> {
    if (!node.contentHash || node.size === 0) return new Uint8Array(node.size);
    const blob = this.blobs.get(node.contentHash);
    if (!blob || blob.size !== node.size) throw new Error(`Filesystem blob metadata is missing for ${node.id}`);
    const bytes = new Uint8Array(node.size);
    let offset = 0;
    for (let index = 0; index < blob.chunkCount; index += 1) {
      const chunk = await this.repository.readChunk(blob.hash, index);
      if (!chunk) throw new Error(`Filesystem content chunk is missing for ${node.id}`);
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (offset !== node.size) throw new Error(`Filesystem content is truncated for ${node.id}`);
    if (await sha256(bytes) !== node.contentHash) throw new Error(`Filesystem content hash mismatch for ${node.id}`);
    return bytes;
  }

  private copyTree(
    nodes: Map<NodeId, StoredNode>, blobs: Map<string, StoredBlob>, source: StoredNode,
    newParentId: NodeId, newName: string, events: FsEvent[],
  ): StoredNode {
    const now = this.now();
    const copy: StoredNode = {
      ...cloneStoredNode(source),
      id: this.nextId(),
      parentId: newParentId,
      name: newName,
      nameKey: nameKey(newName),
      createdAt: now,
      modifiedAt: now,
    };
    nodes.set(copy.id, copy);
    if (copy.contentHash) {
      const blob = blobs.get(copy.contentHash);
      if (!blob) throw new Error(`Filesystem blob metadata is missing for ${source.id}`);
      blob.refCount += 1;
    }
    events.push({ type: "created", node: clonePublicNode(copy) });
    if (source.kind === "directory") {
      for (const child of childrenOf(nodes, source.id).filter((candidate) => candidate.id !== copy.id)) {
        this.copyTree(nodes, blobs, child, copy.id, child.name, events);
      }
    }
    return copy;
  }
}

function makeNode(
  id: NodeId, parentId: NodeId | null, name: string, kind: FsNode["kind"], now: number,
  metadata: Record<string, JsonValue>, mime?: string,
): StoredNode {
  return {
    id, parentId, name, nameKey: nameKey(name), kind, size: 0, createdAt: now, modifiedAt: now,
    metadata: cloneMetadata(metadata), ...(mime ? { mime } : {}),
  };
}

function clonePublicNode(node: StoredNode): FsNode {
  const { nameKey: _nameKey, ...publicNode } = cloneStoredNode(node);
  return publicNode;
}

function cloneStoredNode(node: StoredNode): StoredNode {
  return { ...node, metadata: cloneMetadata(node.metadata) };
}

function cloneMetadata(metadata: Record<string, JsonValue>): Record<string, JsonValue> {
  return structuredClone(metadata);
}

function cloneNodeMap(nodes: Map<NodeId, StoredNode>): Map<NodeId, StoredNode> {
  return new Map([...nodes].map(([id, node]) => [id, cloneStoredNode(node)]));
}

function cloneBlobMap(blobs: Map<string, StoredBlob>): Map<string, StoredBlob> {
  return new Map([...blobs].map(([hash, blob]) => [hash, { ...blob }]));
}

function requireNodeFrom(nodes: Map<NodeId, StoredNode>, id: NodeId): StoredNode {
  const node = nodes.get(id);
  if (!node) throw new Error(`Unknown filesystem node: ${id}`);
  return node;
}

function childrenOf(nodes: Map<NodeId, StoredNode>, parentId: NodeId): StoredNode[] {
  return [...nodes.values()].filter((node) => node.parentId === parentId);
}

function validateName(name: string): void {
  if (!name || name === "." || name === "..") throw new Error("Filesystem name cannot be empty or relative");
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) throw new Error("Filesystem name contains a forbidden character");
}

function nameKey(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

function assertUniqueName(nodes: Map<NodeId, StoredNode>, parentId: NodeId, name: string, ignoreId?: NodeId): void {
  const key = nameKey(name);
  const duplicate = [...nodes.values()].some((node) => node.parentId === parentId && node.id !== ignoreId && node.nameKey === key);
  if (duplicate) throw new Error(`A sibling named '${name}' already exists`);
}

function assertNotDescendant(nodes: Map<NodeId, StoredNode>, sourceId: NodeId, destinationId: NodeId): void {
  if (sourceId === destinationId) throw new Error("Cannot move or copy a directory into itself");
  let current = nodes.get(destinationId);
  const seen = new Set<NodeId>();
  while (current) {
    if (current.id === sourceId) throw new Error("Cannot move or copy a directory into its descendant");
    if (seen.has(current.id)) throw new Error("Filesystem parent cycle detected");
    seen.add(current.id);
    if (current.parentId === null) break;
    current = nodes.get(current.parentId);
  }
}

function normalizeOffset(offset: number): number {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Filesystem offset must be a non-negative safe integer");
  return offset;
}

function normalizeRange(size: number, range?: FsReadRange): { offset: number; length: number } {
  if (!range) return { offset: 0, length: size };
  const offset = normalizeOffset(range.offset);
  if (!Number.isSafeInteger(range.length) || range.length < 0) throw new Error("Filesystem range length must be a non-negative safe integer");
  if (offset >= size) return { offset, length: 0 };
  return { offset, length: Math.min(range.length, size - offset) };
}

function sortNodes(nodes: FsNode[], sort: NonNullable<FsListOptions["sort"]>): void {
  const byName = (a: FsNode, b: FsNode) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);
  nodes.sort((a, b) => {
    if (sort === "modified") return b.modifiedAt - a.modifiedAt || byName(a, b);
    if (sort === "size") return a.size - b.size || byName(a, b);
    if (sort === "type") return a.kind.localeCompare(b.kind) || byName(a, b);
    return byName(a, b);
  });
}

function releaseBlob(blobs: Map<string, StoredBlob>, hash: string, deletes: ChunkDelete[]): void {
  const blob = blobs.get(hash);
  if (!blob) throw new Error(`Filesystem blob metadata is missing: ${hash}`);
  blob.refCount -= 1;
  if (blob.refCount > 0) return;
  blobs.delete(hash);
  for (let index = 0; index < blob.chunkCount; index += 1) deletes.push({ hash, index });
}

function removeTree(
  nodes: Map<NodeId, StoredNode>, blobs: Map<string, StoredBlob>, node: StoredNode,
  events: FsEvent[], deletes: ChunkDelete[],
): void {
  for (const child of childrenOf(nodes, node.id)) removeTree(nodes, blobs, child, events, deletes);
  if (node.contentHash) releaseBlob(blobs, node.contentHash, deletes);
  nodes.delete(node.id);
  if (node.parentId !== null) events.push({ type: "removed", id: node.id, parentId: node.parentId });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
