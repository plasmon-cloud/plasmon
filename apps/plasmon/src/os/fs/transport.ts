import type { JsonValue, NodeId, Revision } from "../contracts/common.ts";
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

export const FS_STATE_TOPIC = "fs";
export const FS_BACKGROUND_TARGET = "app:plasmon:background";
export const TRANSPORT_CHUNK_BYTES = 384 * 1024;
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const UPLOAD_TTL_MS = 5 * 60 * 1000;

export const FS_TOOLS = {
  stat: "plasmon.fs.stat",
  resolvePath: "plasmon.fs.resolve_path",
  pathOf: "plasmon.fs.path_of",
  list: "plasmon.fs.list",
  mkdir: "plasmon.fs.mkdir",
  createFile: "plasmon.fs.create_file",
  rename: "plasmon.fs.rename",
  move: "plasmon.fs.move",
  copy: "plasmon.fs.copy",
  remove: "plasmon.fs.remove",
  metadataPatch: "plasmon.fs.metadata_patch",
  readChunk: "plasmon.fs.read_chunk",
  writeBegin: "plasmon.fs.write_begin",
  writeChunk: "plasmon.fs.write_chunk",
  writeCommit: "plasmon.fs.write_commit",
  writeAbort: "plasmon.fs.write_abort",
  revision: "plasmon.fs.revision",
} as const;

export type FsToolName = (typeof FS_TOOLS)[keyof typeof FS_TOOLS];
export type JsonObject = { [key: string]: JsonValue };

interface UploadSession {
  id: string;
  nodeId: NodeId;
  offset: number;
  truncate: boolean;
  totalBytes: number;
  expectedHash: string;
  chunks: Map<number, Uint8Array>;
  receivedBytes: number;
  createdAt: number;
}

export class FsRpcServer {
  private readonly uploads = new Map<string, UploadSession>();

  constructor(
    private readonly fs: FsService,
    private readonly now: () => number = Date.now,
    private readonly randomUUID: () => string = () => crypto.randomUUID(),
  ) {}

  async call(name: FsToolName, args: JsonObject): Promise<JsonValue> {
    this.expireUploads();
    switch (name) {
      case FS_TOOLS.stat:
        return nodeToJson(await this.fs.stat(requiredString(args, "id")));
      case FS_TOOLS.resolvePath: {
        const node = await this.fs.resolvePath(requiredString(args, "path"));
        return node ? nodeToJson(node) : null;
      }
      case FS_TOOLS.pathOf:
        return { path: await this.fs.pathOf(requiredString(args, "id")) };
      case FS_TOOLS.list: {
        const options = parseListOptions(args.options);
        return (await this.fs.list(requiredString(args, "parentId"), options)).map(nodeToJson);
      }
      case FS_TOOLS.mkdir:
        return nodeToJson(await this.fs.mkdir(requiredString(args, "parentId"), requiredString(args, "name")));
      case FS_TOOLS.createFile:
        return nodeToJson(await this.fs.createFile(
          requiredString(args, "parentId"),
          requiredString(args, "name"),
          parseCreateFileOptions(args.options),
        ));
      case FS_TOOLS.rename:
        return nodeToJson(await this.fs.rename(requiredString(args, "id"), requiredString(args, "newName")));
      case FS_TOOLS.move:
        return nodeToJson(await this.fs.move(requiredString(args, "id"), requiredString(args, "newParentId")));
      case FS_TOOLS.copy: {
        const nameArg = args.name;
        const copyName = nameArg === undefined || nameArg === null ? undefined : requiredString(args, "name");
        return nodeToJson(await this.fs.copy(requiredString(args, "id"), requiredString(args, "newParentId"), copyName));
      }
      case FS_TOOLS.remove:
        await this.fs.remove(requiredString(args, "id"), { recursive: optionalBoolean(args, "recursive") ?? false });
        return {};
      case FS_TOOLS.metadataPatch:
        return nodeToJson(await this.fs.setMetadata(requiredString(args, "id"), parseMetadataPatch(args.patch)));
      case FS_TOOLS.readChunk: {
        const length = requiredInteger(args, "length");
        if (length < 0 || length > TRANSPORT_CHUNK_BYTES) throw new Error("Filesystem RPC read chunk exceeds transport limit");
        const offset = requiredInteger(args, "offset");
        if (offset < 0) throw new Error("Filesystem RPC read offset cannot be negative");
        const id = requiredString(args, "id");
        const expectedContentHash = requiredSha256(args, "expectedContentHash");
        const expectedSize = requiredInteger(args, "expectedSize");
        if (expectedSize < 0) throw new Error("Filesystem RPC expected read size cannot be negative");
        await this.assertReadIdentity(id, expectedContentHash, expectedSize);
        const bytes = await this.fs.read(id, { offset, length });
        await this.assertReadIdentity(id, expectedContentHash, expectedSize);
        return { data: encodeBase64(bytes), byteLength: bytes.length };
      }
      case FS_TOOLS.writeBegin:
        return this.writeBegin(args);
      case FS_TOOLS.writeChunk:
        return this.writeChunk(args);
      case FS_TOOLS.writeCommit:
        return this.writeCommit(args);
      case FS_TOOLS.writeAbort:
        return this.writeAbort(args);
      case FS_TOOLS.revision:
        return { revision: (await this.fs.revision()).toString() };
      default:
        throw new Error(`Unknown filesystem RPC tool: ${name}`);
    }
  }

  private writeBegin(args: JsonObject): JsonValue {
    const totalBytes = requiredInteger(args, "totalBytes");
    const offset = requiredInteger(args, "offset");
    const expectedHash = requiredSha256(args, "expectedHash");
    if (totalBytes < 0 || totalBytes > MAX_UPLOAD_BYTES) throw new Error("Filesystem RPC upload size is invalid");
    if (offset < 0) throw new Error("Filesystem RPC write offset cannot be negative");
    const uploadId = `fs-upload:${this.randomUUID()}`;
    this.uploads.set(uploadId, {
      id: uploadId,
      nodeId: requiredString(args, "id"),
      offset,
      truncate: optionalBoolean(args, "truncate") ?? false,
      totalBytes,
      expectedHash,
      chunks: new Map(),
      receivedBytes: 0,
      createdAt: this.now(),
    });
    return { uploadId, chunkBytes: TRANSPORT_CHUNK_BYTES };
  }

  private writeChunk(args: JsonObject): JsonValue {
    const upload = this.requireUpload(requiredString(args, "uploadId"));
    const index = requiredInteger(args, "index");
    if (index < 0) throw new Error("Filesystem RPC upload chunk index cannot be negative");
    if (upload.chunks.has(index)) throw new Error("Filesystem RPC upload chunk was already supplied");
    const bytes = decodeBase64(requiredString(args, "data"));
    if (bytes.length > TRANSPORT_CHUNK_BYTES) throw new Error("Filesystem RPC write chunk exceeds transport limit");
    if (upload.receivedBytes + bytes.length > upload.totalBytes) throw new Error("Filesystem RPC upload exceeds declared size");
    upload.chunks.set(index, bytes);
    upload.receivedBytes += bytes.length;
    return { receivedBytes: upload.receivedBytes };
  }

  private async writeCommit(args: JsonObject): Promise<JsonValue> {
    const uploadId = requiredString(args, "uploadId");
    const upload = this.requireUpload(uploadId);
    if (upload.receivedBytes !== upload.totalBytes) throw new Error("Filesystem RPC upload is incomplete");
    const chunkCount = Math.ceil(upload.totalBytes / TRANSPORT_CHUNK_BYTES);
    const bytes = new Uint8Array(upload.totalBytes);
    let offset = 0;
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = upload.chunks.get(index);
      if (!chunk) throw new Error(`Filesystem RPC upload chunk ${index} is missing`);
      const expected = index === chunkCount - 1
        ? upload.totalBytes - index * TRANSPORT_CHUNK_BYTES
        : TRANSPORT_CHUNK_BYTES;
      if (chunk.length !== expected) throw new Error(`Filesystem RPC upload chunk ${index} has an invalid length`);
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== upload.expectedHash) {
      this.uploads.delete(uploadId);
      throw new Error("Filesystem RPC upload SHA-256 mismatch");
    }
    this.uploads.delete(uploadId);
    return nodeToJson(await this.fs.write(upload.nodeId, bytes, { offset: upload.offset, truncate: upload.truncate }));
  }

  private async assertReadIdentity(id: NodeId, expectedContentHash: string, expectedSize: number): Promise<void> {
    const node = await this.fs.stat(id);
    if (node.kind === "directory") throw new Error("Cannot read a directory");
    if (node.size !== expectedSize || node.contentHash !== expectedContentHash) {
      throw new Error("Filesystem changed during read; retry the operation");
    }
  }

  private writeAbort(args: JsonObject): JsonValue {
    this.uploads.delete(requiredString(args, "uploadId"));
    return {};
  }

  private requireUpload(uploadId: string): UploadSession {
    const upload = this.uploads.get(uploadId);
    if (!upload) throw new Error("Unknown or expired filesystem RPC upload");
    return upload;
  }

  private expireUploads(): void {
    const cutoff = this.now() - UPLOAD_TTL_MS;
    for (const [id, upload] of this.uploads) if (upload.createdAt < cutoff) this.uploads.delete(id);
  }
}

export type FsToolCaller = (name: FsToolName, arguments_: JsonObject) => Promise<JsonValue>;
export type FsStateSubscriber = (topic: string, listener: () => void) => () => void;

/** Foreground contract implementation. File bytes always cross RPC in bounded raw chunks. */
export class FsRpcClient implements FsService, FsEventSource {
  private readonly listeners = new Set<(event: FsEvent) => void>();
  private unsubscribeState: (() => void) | null = null;
  private resetPending = false;

  constructor(
    private readonly callTool: FsToolCaller,
    private readonly subscribeState?: FsStateSubscriber,
  ) {}

  subscribe(listener: (event: FsEvent) => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1 && this.subscribeState) {
      this.unsubscribeState = this.subscribeState(FS_STATE_TOPIC, () => this.queueReset());
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.unsubscribeState?.();
        this.unsubscribeState = null;
      }
    };
  }

  async stat(id: NodeId): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.stat, { id }));
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    const value = await this.callTool(FS_TOOLS.resolvePath, { path });
    return value === null ? null : parseNode(value);
  }

  async pathOf(id: NodeId): Promise<string> {
    return requiredString(asObject(await this.callTool(FS_TOOLS.pathOf, { id })), "path");
  }

  async list(parentId: NodeId, options: FsListOptions = {}): Promise<FsNode[]> {
    const value = await this.callTool(FS_TOOLS.list, { parentId, options: compactJson(options) });
    if (!Array.isArray(value)) throw new Error("Invalid filesystem list response");
    return value.map(parseNode);
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.mkdir, { parentId, name }));
  }

  async createFile(parentId: NodeId, name: string, options: CreateFileOptions = {}): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.createFile, { parentId, name, options: compactJson(options) }));
  }

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    const node = await this.stat(id);
    const start = range?.offset ?? 0;
    const wanted = range ? Math.min(Math.max(range.length, 0), Math.max(node.size - start, 0)) : Math.max(node.size - start, 0);
    validateSafeNonNegative(start, "Filesystem read offset");
    validateSafeNonNegative(wanted, "Filesystem read length");
    const result = new Uint8Array(wanted);
    let copied = 0;
    while (copied < wanted) {
      const length = Math.min(TRANSPORT_CHUNK_BYTES, wanted - copied);
      if (!node.contentHash) throw new Error("Filesystem readable content is missing a content hash");
      const response = asObject(await this.callTool(FS_TOOLS.readChunk, {
        id,
        offset: start + copied,
        length,
        expectedContentHash: node.contentHash,
        expectedSize: node.size,
      }));
      const bytes = decodeBase64(requiredString(response, "data"));
      const declared = requiredInteger(response, "byteLength");
      if (bytes.length !== declared || bytes.length > length) throw new Error("Invalid filesystem read chunk response");
      if (bytes.length === 0 && copied < wanted) throw new Error("Filesystem read ended before the requested range");
      result.set(bytes, copied);
      copied += bytes.length;
    }
    return result;
  }

  async write(id: NodeId, bytes: Uint8Array, options: WriteOptions = {}): Promise<FsNode> {
    if (!(bytes instanceof Uint8Array)) throw new Error("Filesystem writes require Uint8Array bytes");
    const offset = options.offset ?? 0;
    validateSafeNonNegative(offset, "Filesystem write offset");
    const expectedHash = await sha256Hex(bytes);
    const begin = asObject(await this.callTool(FS_TOOLS.writeBegin, {
      id,
      offset,
      truncate: options.truncate ?? false,
      totalBytes: bytes.length,
      expectedHash,
    }));
    const uploadId = requiredString(begin, "uploadId");
    const chunkBytes = requiredInteger(begin, "chunkBytes");
    if (chunkBytes <= 0 || chunkBytes > TRANSPORT_CHUNK_BYTES) throw new Error("Invalid filesystem upload chunk limit");
    try {
      let index = 0;
      for (let position = 0; position < bytes.length; position += chunkBytes) {
        await this.callTool(FS_TOOLS.writeChunk, {
          uploadId,
          index,
          data: encodeBase64(bytes.subarray(position, position + chunkBytes)),
        });
        index += 1;
      }
      return parseNode(await this.callTool(FS_TOOLS.writeCommit, { uploadId }));
    } catch (error) {
      await this.callTool(FS_TOOLS.writeAbort, { uploadId }).catch(() => undefined);
      throw error;
    }
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.rename, { id, newName }));
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.move, { id, newParentId }));
  }

  async copy(id: NodeId, newParentId: NodeId, name?: string): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.copy, { id, newParentId, ...(name === undefined ? {} : { name }) }));
  }

  async remove(id: NodeId, options: { recursive?: boolean } = {}): Promise<void> {
    await this.callTool(FS_TOOLS.remove, { id, recursive: options.recursive ?? false });
  }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    return parseNode(await this.callTool(FS_TOOLS.metadataPatch, { id, patch: patch as JsonValue }));
  }

  async revision(): Promise<Revision> {
    const response = asObject(await this.callTool(FS_TOOLS.revision, {}));
    return BigInt(requiredString(response, "revision"));
  }

  private queueReset(): void {
    if (this.resetPending) return;
    this.resetPending = true;
    queueMicrotask(() => {
      void this.revision().then((revision) => {
        for (const listener of this.listeners) listener({ type: "reset", revision });
      }).catch(() => undefined).finally(() => { this.resetPending = false; });
    });
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const piece = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += piece) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + piece));
  }
  return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function nodeToJson(node: FsNode): JsonObject {
  return {
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    kind: node.kind,
    size: node.size,
    createdAt: node.createdAt,
    modifiedAt: node.modifiedAt,
    metadata: node.metadata,
    ...(node.mime === undefined ? {} : { mime: node.mime }),
    ...(node.contentHash === undefined ? {} : { contentHash: node.contentHash }),
  };
}

function parseNode(value: JsonValue): FsNode {
  const node = asObject(value);
  const kind = requiredString(node, "kind");
  if (kind !== "directory" && kind !== "file" && kind !== "shortcut" && kind !== "atom") throw new Error("Invalid filesystem node kind");
  const parent = node.parentId;
  if (parent !== null && typeof parent !== "string") throw new Error("Invalid filesystem parent ID");
  const metadataValue = node.metadata;
  if (!isObject(metadataValue)) throw new Error("Invalid filesystem metadata");
  return {
    id: requiredString(node, "id"),
    parentId: parent,
    name: requiredString(node, "name"),
    kind,
    size: requiredInteger(node, "size"),
    createdAt: requiredInteger(node, "createdAt"),
    modifiedAt: requiredInteger(node, "modifiedAt"),
    metadata: structuredClone(metadataValue),
    ...(typeof node.mime === "string" ? { mime: node.mime } : {}),
    ...(typeof node.contentHash === "string" ? { contentHash: node.contentHash } : {}),
  };
}

function parseListOptions(value: JsonValue | undefined): FsListOptions {
  if (value === undefined || value === null) return {};
  const object = asObject(value);
  const sort = object.sort;
  if (sort !== undefined && sort !== "name" && sort !== "modified" && sort !== "size" && sort !== "type") throw new Error("Invalid filesystem sort mode");
  return {
    ...(typeof object.includeHidden === "boolean" ? { includeHidden: object.includeHidden } : {}),
    ...(sort ? { sort } : {}),
  };
}

function parseCreateFileOptions(value: JsonValue | undefined): CreateFileOptions {
  if (value === undefined || value === null) return {};
  const object = asObject(value);
  const kind = object.kind;
  if (kind !== undefined && kind !== "file" && kind !== "shortcut" && kind !== "atom") throw new Error("Invalid filesystem file kind");
  const metadata = object.metadata;
  if (metadata !== undefined && !isObject(metadata)) throw new Error("Invalid filesystem metadata");
  return {
    ...(typeof object.mime === "string" ? { mime: object.mime } : {}),
    ...(kind ? { kind } : {}),
    ...(metadata ? { metadata: structuredClone(metadata) } : {}),
  };
}

function parseMetadataPatch(value: JsonValue | undefined): Record<string, JsonValue | null> {
  if (!isObject(value)) throw new Error("Invalid filesystem metadata patch");
  return structuredClone(value) as Record<string, JsonValue | null>;
}

function compactJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function asObject(value: JsonValue): JsonObject {
  if (!isObject(value)) throw new Error("Invalid filesystem RPC response");
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string") throw new Error(`Filesystem RPC ${key} must be a string`);
  return value;
}

function requiredSha256(object: JsonObject, key: string): string {
  const value = requiredString(object, key);
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`Filesystem RPC ${key} must be a lowercase SHA-256 hex digest`);
  return value;
}

function requiredInteger(object: JsonObject, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`Filesystem RPC ${key} must be a safe integer`);
  return value;
}

function optionalBoolean(object: JsonObject, key: string): boolean | undefined {
  const value = object[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`Filesystem RPC ${key} must be a boolean`);
  return value;
}

function validateSafeNonNegative(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
