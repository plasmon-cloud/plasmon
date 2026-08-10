import { test } from "bun:test";
import assert from "node:assert/strict";
import { MemoryFsRepository, createBrowserFsRepository, type FsRepository, type RepositoryCommit, type RepositoryState } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import {
  FS_STATE_TOPIC,
  FS_TOOLS,
  FsRpcClient,
  FsRpcServer,
  TRANSPORT_CHUNK_BYTES,
  type FsToolName,
  type JsonObject,
} from "./transport.ts";
import type { JsonValue } from "../contracts/common.ts";

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
