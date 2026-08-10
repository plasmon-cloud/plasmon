import { test } from "bun:test";
import { NEUTRON_TOOL_VISIBILITY_SAME_APP } from "neutron-tools/app";
import assert from "node:assert/strict";
import { MemoryFsRepository, createBrowserFsRepository, type FsRepository, type RepositoryCommit, type RepositoryState } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import {
  FS_STATE_TOPIC,
  FS_TOOLS,
  FsRpcClient,
  FsRpcServer,
  TRANSPORT_CHUNK_BYTES,
  decodeBase64,
  encodeBase64,
  sha256Hex,
  type FsToolName,
  type JsonObject,
} from "./transport.ts";
import type { JsonValue } from "../contracts/common.ts";
import type { FsService } from "../contracts/fs.ts";
import { FS_TOOL_DEFINITIONS } from "./toolDefinitions.ts";

const text = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder().decode(value);

async function fresh() {
  const repository = new MemoryFsRepository();
  const fs = new PersistentFsService(repository);
  const desktop = await fs.resolvePath("/Desktop");
  if (!desktop) throw new Error("Desktop was not initialized");
  return { repository, fs, desktop };
}

test("persists state across service reinitialization", async () => {
  const { repository, fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "persistent.txt", { mime: "text/plain" });
  await fs.write(file.id, text("survives"), { truncate: true });
  const revision = await fs.revision();

  const reloaded = new PersistentFsService(repository);
  const resolved = await reloaded.resolvePath("/Desktop/persistent.txt");
  assert.equal(resolved?.id, file.id);
  assert.equal(decode(await reloaded.read(file.id)), "survives");
  assert.equal(await reloaded.revision(), revision);
});

test("rename and move preserve stable NodeId and deterministic paths", async () => {
  const { fs, desktop } = await fresh();
  const documents = await fs.resolvePath("/Documents");
  if (!documents) throw new Error("Documents was not initialized");
  const file = await fs.createFile(desktop.id, "Draft.TXT");
  const renamed = await fs.rename(file.id, "Final.txt");
  const moved = await fs.move(file.id, documents.id);
  assert.equal(renamed.id, file.id);
  assert.equal(moved.id, file.id);
  assert.equal(await fs.pathOf(file.id), "/Documents/Final.txt");
  assert.equal((await fs.resolvePath("/documents/FINAL.TXT"))?.id, file.id);
});

test("duplicate names are case-insensitive and Unicode-normalized", async () => {
  const { fs, desktop } = await fresh();
  await fs.createFile(desktop.id, "Cafe\u0301.txt");
  const before = await fs.revision();
  await assert.rejects(() => fs.createFile(desktop.id, "CAFÉ.TXT"), /already exists/i);
  assert.equal(await fs.revision(), before);
});

test("directories are distinct from file, shortcut, and Atom resources", async () => {
  const { fs, desktop } = await fresh();
  const directory = await fs.mkdir(desktop.id, "Folder");
  await assert.rejects(() => fs.read(directory.id), /directory/i);
  await assert.rejects(() => fs.write(directory.id, text("x")), /directory/i);
  await assert.rejects(() => fs.list(desktop.id + ":missing"), /unknown/i);
  const shortcut = await fs.createFile(desktop.id, "Site.url", { kind: "shortcut" });
  const atom = await fs.createFile(desktop.id, "Notes.atom", { kind: "atom" });
  assert.equal(shortcut.kind, "shortcut");
  assert.equal(atom.kind, "atom");
});

test("ranged reads cross storage chunk boundaries", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "range.bin");
  const bytes = new Uint8Array(700_000);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 251;
  await fs.write(file.id, bytes, { truncate: true });
  const range = await fs.read(file.id, { offset: 510_000, length: 40_000 });
  assert.deepEqual(range, bytes.slice(510_000, 550_000));
});

test("multiple offset writes preserve unaffected bytes and zero-fill gaps", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "offset.bin");
  await fs.write(file.id, new Uint8Array([1, 2, 3, 4]), { truncate: true });
  await fs.write(file.id, new Uint8Array([9, 8]), { offset: 1 });
  await fs.write(file.id, new Uint8Array([7]), { offset: 6 });
  assert.deepEqual([...await fs.read(file.id)], [1, 9, 8, 4, 0, 0, 7]);
});

test("truncate makes offset plus supplied bytes the final length", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "truncate.bin");
  await fs.write(file.id, new Uint8Array([1, 2, 3, 4, 5]), { truncate: true });
  const result = await fs.write(file.id, new Uint8Array([9]), { offset: 2, truncate: true });
  assert.equal(result.size, 3);
  assert.deepEqual([...await fs.read(file.id)], [1, 2, 9]);
});

test("metadata patches add, replace, and remove xattrs", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "meta.txt", { metadata: { pinned: true } });
  const changed = await fs.setMetadata(file.id, { pinned: null, label: "blue", nested: { count: 2 } });
  assert.deepEqual(changed.metadata, { label: "blue", nested: { count: 2 } });
});

test("revision changes exactly once per committed operation and emits invalidation events", async () => {
  const { fs, desktop } = await fresh();
  const events: string[] = [];
  fs.subscribe((event) => events.push(event.type));
  const initial = await fs.revision();
  const file = await fs.createFile(desktop.id, "revision.txt");
  assert.equal(await fs.revision(), initial + 1n);
  await fs.write(file.id, text("one"), { truncate: true });
  assert.equal(await fs.revision(), initial + 2n);
  await assert.rejects(() => fs.createFile(desktop.id, "REVISION.TXT"), /already exists/i);
  assert.equal(await fs.revision(), initial + 2n);
  assert.deepEqual(events, ["created", "changed"]);
});

test("copy creates fresh identities while reusing equivalent content", async () => {
  const { fs, desktop } = await fresh();
  const documents = await fs.resolvePath("/Documents");
  if (!documents) throw new Error("Documents was not initialized");
  const folder = await fs.mkdir(desktop.id, "Tree");
  const file = await fs.createFile(folder.id, "payload.bin");
  const written = await fs.write(file.id, new Uint8Array([4, 5, 6]), { truncate: true });
  const copy = await fs.copy(folder.id, documents.id);
  const copiedFile = await fs.resolvePath("/Documents/Tree/payload.bin");
  if (!copiedFile) throw new Error("Copied file was not found");
  assert.notEqual(copy.id, folder.id);
  assert.notEqual(copiedFile.id, file.id);
  assert.equal(copiedFile.contentHash, written.contentHash);
  assert.deepEqual(await fs.read(copiedFile.id), new Uint8Array([4, 5, 6]));
});

test("non-recursive removal rejects non-empty directories and recursive removal deletes the tree", async () => {
  const { fs, desktop } = await fresh();
  const folder = await fs.mkdir(desktop.id, "Delete Me");
  const child = await fs.createFile(folder.id, "child.txt");
  await fs.write(child.id, text("data"), { truncate: true });
  await assert.rejects(() => fs.remove(folder.id), /not empty/i);
  await fs.remove(folder.id, { recursive: true });
  assert.equal(await fs.resolvePath("/Desktop/Delete Me"), null);
  await assert.rejects(() => fs.stat(child.id), /unknown/i);
});

test("full reads reject corrupted content hashes", async () => {
  class CorruptingRepository implements FsRepository {
    readonly kind = "corrupting";
    constructor(readonly inner = new MemoryFsRepository()) {}
    load(): Promise<RepositoryState | null> { return this.inner.load(); }
    commit(change: RepositoryCommit): Promise<void> { return this.inner.commit(change); }
    async readChunk(hash: string, index: number): Promise<Uint8Array | null> {
      const bytes = await this.inner.readChunk(hash, index);
      if (bytes?.length) bytes[0] ^= 0xff;
      return bytes;
    }
  }
  const repository = new CorruptingRepository();
  const fs = new PersistentFsService(repository);
  const desktop = await fs.resolvePath("/Desktop");
  if (!desktop) throw new Error("Desktop was not initialized");
  const file = await fs.createFile(desktop.id, "corrupt.bin");
  await fs.write(file.id, new Uint8Array([1, 2, 3]), { truncate: true });
  await assert.rejects(() => fs.read(file.id), /hash mismatch/i);
});

test("fallback selection uses memory when persistent browser storage is unavailable", async () => {
  const reasons: Error[] = [];
  const repository = await createBrowserFsRepository({ indexedDB: null, onFallback: (reason) => reasons.push(reason) });
  assert.equal(repository.kind, "memory");
  assert.equal(reasons.length, 0);
});

test("RPC client receives reset invalidation from background state changes", async () => {
  const { fs, desktop } = await fresh();
  const server = new FsRpcServer(fs);
  let stateListener: (() => void) | undefined;
  const client = new FsRpcClient(
    (name, args) => server.call(name, args),
    (topic, listener) => {
      assert.equal(topic, FS_STATE_TOPIC);
      stateListener = listener;
      return () => { stateListener = undefined; };
    },
  );
  const resets: bigint[] = [];
  const unsubscribe = client.subscribe((event) => { if (event.type === "reset") resets.push(event.revision); });
  await fs.createFile(desktop.id, "external.txt");
  stateListener?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(resets, [await fs.revision()]);
  unsubscribe();
});

test("10+ MiB RPC roundtrip uses bounded transport messages", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "large.bin");
  const server = new FsRpcServer(fs);
  let largestArguments = 0;
  let writeChunkCalls = 0;
  const caller = async (name: FsToolName, args: JsonObject): Promise<JsonValue> => {
    largestArguments = Math.max(largestArguments, new TextEncoder().encode(JSON.stringify(args)).length);
    if (name === FS_TOOLS.writeChunk) writeChunkCalls += 1;
    return server.call(name, args);
  };
  const client = new FsRpcClient(caller);
  const bytes = new Uint8Array(10 * 1024 * 1024 + 12345);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31) % 256;
  const written = await client.write(file.id, bytes, { truncate: true });
  assert.equal(written.size, bytes.length);
  assert.ok(writeChunkCalls > 20);
  assert.ok(largestArguments < 1024 * 1024, `largest JSON arguments were ${largestArguments} bytes`);
  assert.ok(TRANSPORT_CHUNK_BYTES < 1024 * 1024);
  const read = await client.read(file.id);
  assert.deepEqual(read, bytes);
});

test("filesystem background tool descriptors are same-app only and preserve effects", () => {
  const expectedNames = new Set(Object.values(FS_TOOLS));
  assert.equal(FS_TOOL_DEFINITIONS.length, expectedNames.size);
  for (const definition of FS_TOOL_DEFINITIONS) {
    assert.ok(expectedNames.delete(definition.name), `duplicate or unknown filesystem tool ${definition.name}`);
    assert.equal(definition.annotations["neutron:visibility"], NEUTRON_TOOL_VISIBILITY_SAME_APP);
    assert.deepEqual(definition.annotations["neutron:effects"], [definition.write ? "write" : "read"]);
  }
  assert.equal(expectedNames.size, 0, `missing filesystem tool descriptors: ${[...expectedNames].join(", ")}`);
});

test("staged RPC write verifies the expected upload SHA-256 before mutation", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "upload.bin");
  await fs.write(file.id, text("original"), { truncate: true });
  const server = new FsRpcServer(fs);
  const client = new FsRpcClient((name, args) => server.call(name, args));
  const valid = new Uint8Array(TRANSPORT_CHUNK_BYTES + 37);
  for (let index = 0; index < valid.length; index += 1) valid[index] = index % 251;

  const written = await client.write(file.id, valid, { truncate: true });
  assert.equal(written.contentHash, await sha256Hex(valid));
  assert.deepEqual(await fs.read(file.id), valid);

  const beforeBytes = await fs.read(file.id);
  const beforeRevision = await fs.revision();
  let tampered = false;
  const tamperingClient = new FsRpcClient(async (name, args) => {
    if (name === FS_TOOLS.writeChunk && !tampered) {
      tampered = true;
      const changed = { ...args };
      const chunk = decodeBase64(String(args.data));
      chunk[0] ^= 0xff;
      changed.data = encodeBase64(chunk);
      return server.call(name, changed);
    }
    return server.call(name, args);
  });
  const attempted = new Uint8Array(TRANSPORT_CHUNK_BYTES + 11).fill(0x5a);
  await assert.rejects(() => tamperingClient.write(file.id, attempted, { truncate: true }), /SHA-256 mismatch/);
  assert.deepEqual(await fs.read(file.id), beforeBytes);
  assert.equal(await fs.revision(), beforeRevision);
});

test("normal multi-chunk foreground read stays bound to one content identity", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "snapshot.bin");
  const bytes = new Uint8Array(TRANSPORT_CHUNK_BYTES * 2 + 29);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 17) % 256;
  await fs.write(file.id, bytes, { truncate: true });
  const server = new FsRpcServer(fs);
  const client = new FsRpcClient((name, args) => server.call(name, args));
  assert.deepEqual(await client.read(file.id), bytes);
});

test("multi-chunk foreground read rejects instead of mixing concurrent file revisions", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "changing.bin");
  const first = new Uint8Array(TRANSPORT_CHUNK_BYTES * 2 + 41).fill(0x11);
  const second = new Uint8Array(first.length).fill(0x22);
  await fs.write(file.id, first, { truncate: true });
  const server = new FsRpcServer(fs);
  let readChunks = 0;
  const client = new FsRpcClient(async (name, args) => {
    if (name === FS_TOOLS.readChunk) {
      readChunks += 1;
      if (readChunks === 2) await fs.write(file.id, second, { truncate: true });
    }
    return server.call(name, args);
  });

  await assert.rejects(() => client.read(file.id), /changed during read; retry/i);
  assert.equal(readChunks, 2);
  assert.deepEqual(await fs.read(file.id), second);
});

test("read chunk post-check detects a content change during the underlying read", async () => {
  const { fs, desktop } = await fresh();
  const file = await fs.createFile(desktop.id, "racing.bin");
  const first = new Uint8Array(TRANSPORT_CHUNK_BYTES + 19).fill(0x33);
  const second = new Uint8Array(first.length).fill(0x44);
  await fs.write(file.id, first, { truncate: true });
  let injectChange = true;
  const racingFs = new Proxy(fs, {
    get(target, property, receiver) {
      if (property === "read") {
        return async (id: string, range?: { offset: number; length: number }) => {
          const bytes = await target.read(id, range);
          if (injectChange) {
            injectChange = false;
            await target.write(file.id, second, { truncate: true });
          }
          return bytes;
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as FsService;
  const server = new FsRpcServer(racingFs);
  const client = new FsRpcClient((name, args) => server.call(name, args));

  await assert.rejects(() => client.read(file.id), /changed during read; retry/i);
  assert.deepEqual(await fs.read(file.id), second);
});

test("reset revision lookup failure is contained and a later invalidation can recover", async () => {
  let stateListener: (() => void) | undefined;
  let revisionCalls = 0;
  const client = new FsRpcClient(
    async (name) => {
      if (name !== FS_TOOLS.revision) throw new Error("unexpected tool");
      revisionCalls += 1;
      if (revisionCalls === 1) throw new Error("temporary revision lookup failure");
      return { revision: "9" };
    },
    (_topic, listener) => {
      stateListener = listener;
      return () => { stateListener = undefined; };
    },
  );
  const resets: bigint[] = [];
  client.subscribe((event) => { if (event.type === "reset") resets.push(event.revision); });
  stateListener?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  stateListener?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(resets, [9n]);
});
