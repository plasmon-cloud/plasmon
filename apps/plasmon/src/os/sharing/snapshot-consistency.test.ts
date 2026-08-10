import { expect, test } from "bun:test";
import type { JsonValue, NodeId } from "../contracts/common.ts";
import type { FsReadRange } from "../contracts/fs.ts";
import { MemoryFs } from "../integration/fakes.ts";
import {
  MemorySharedResourceStore,
  PLASMON_ATOM_NAMESPACE,
  ResourceIntegrityError,
  StableSharedResourceProvider,
} from "./index.ts";

const encoder = new TextEncoder();

function atomValue(
  atomId: string,
  atomType = "notepad2/v1",
  title = "Story",
): JsonValue {
  return {
    format: "plasmon.atom",
    version: 1,
    atomId,
    handlerId: "neutron:notepad2",
    atomType,
    schemaVersion: 1,
    title,
  };
}

async function makeAtom(
  fs: MemoryFs,
  parentId: NodeId,
  bytes: Uint8Array,
  atomId = "atom-before",
) {
  const node = await fs.createFile(parentId, `${atomId}.notepad2.atom`, {
    kind: "atom",
    mime: "application/x-plasmon-atom",
    metadata: { atom: atomValue(atomId) },
  });
  await fs.write(node.id, bytes, { truncate: true });
  return fs.stat(node.id);
}

class SnapshotMutationFs extends MemoryFs {
  private rangedReads = 0;
  mutateAfterFirstRangedRead: (() => Promise<void>) | null = null;

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    const bytes = await super.read(id, range);
    if (!range) return bytes;

    this.rangedReads += 1;
    if (this.rangedReads === 1 && this.mutateAfterFirstRangedRead) {
      const mutate = this.mutateAfterFirstRangedRead;
      this.mutateAfterFirstRangedRead = null;
      await mutate();
    }
    return bytes;
  }
}

test("source mutation aborts without a revision and a later stable publication contains the complete new bytes", async () => {
  const fs = new SnapshotMutationFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const initial = encoder.encode("abcdefgh");
  const replacement = encoder.encode("ABCDEFGH");
  const atom = await makeAtom(fs, docs.id, initial);
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 4 });

  fs.mutateAfterFirstRangedRead = async () => {
    await fs.write(atom.id, replacement, { truncate: true });
  };

  await expect(provider.publish(atom.id)).rejects.toThrow(
    "Filesystem source changed during publication snapshot",
  );
  expect(store.stats().resourceCount).toBe(0);
  expect(store.stats().revisionCount).toBe(0);
  // Chunk uploads precede the final revision guard, so an aborted attempt can
  // leave unreferenced content-addressed chunks for future reclamation.
  expect(store.stats().chunkCount).toBeGreaterThan(0);

  const published = await provider.publish(atom.id);
  expect(published.resource.revision).toBe("1");
  expect([...await provider.openInternalResource(published.resource).readAll()]).toEqual([...replacement]);
});

test("Atom metadata mutation during publication is guarded by the same filesystem snapshot revision", async () => {
  const fs = new SnapshotMutationFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const bytes = encoder.encode("abcdefgh");
  const atom = await makeAtom(fs, docs.id, bytes, "atom-before");
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 4 });

  fs.mutateAfterFirstRangedRead = async () => {
    await fs.setMetadata(atom.id, {
      atom: atomValue("atom-after", "notepad2/v2", "Updated Story"),
    });
  };

  await expect(provider.publish(atom.id)).rejects.toBeInstanceOf(ResourceIntegrityError);
  expect(store.stats().resourceCount).toBe(0);
  expect(store.stats().revisionCount).toBe(0);
  expect(await store.describe({ namespace: PLASMON_ATOM_NAMESPACE, resourceId: "atom-before" })).toBeNull();

  const published = await provider.publish(atom.id);
  expect(published.resource.resourceId).toBe("atom-after");
  expect(published.resource.revision).toBe("1");

  const described = await provider.describePublished(published.resource);
  expect(described.revision.resourceType).toBe("notepad2/v2");
  expect(described.revision.snapshot.atom?.title).toBe("Updated Story");
  expect([...await provider.openInternalResource(published.resource).readAll()]).toEqual([...bytes]);
});
