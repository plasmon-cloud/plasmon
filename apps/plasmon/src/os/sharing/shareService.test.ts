import { expect, test } from "bun:test";
import type { JsonValue, NodeId } from "../contracts/common.ts";
import type {
  IssueResourceGrantRequest,
  IssuedResourceGrant,
  ResourceAuthorization,
  ResourceAuthorizationService,
  ResourceGrantSummary,
} from "../contracts/authorization.ts";
import { MemoryFs } from "../integration/fakes.ts";
import {
  MemorySharedResourceStore,
  PLASMON_ATOM_NAMESPACE,
  ResourceAuthorizedShareService,
  SharingAuthorizationContractMismatchError,
  SharingAuthorizationUnavailableError,
  StableSharedResourceProvider,
} from "./index.ts";

const encoder = new TextEncoder();

function atomMetadata(atomId = "atom-phase-b"): Record<string, JsonValue> {
  return {
    atom: {
      format: "plasmon.atom",
      version: 1,
      atomId,
      handlerId: "neutron:notepad2",
      atomType: "notepad2/v1",
      schemaVersion: 1,
      title: "Phase B",
    },
  };
}

async function makeAtom(fs: MemoryFs, parentId: NodeId, bytes: Uint8Array) {
  const node = await fs.createFile(parentId, "phase-b.notepad2.atom", {
    kind: "atom",
    mime: "application/x-plasmon-atom",
    metadata: atomMetadata(),
  });
  await fs.write(node.id, bytes, { truncate: true });
  return fs.stat(node.id);
}

type FakeGrant = {
  issued: IssuedResourceGrant;
  revoked: boolean;
  authorizationEpoch: number;
};

class FakeResourceAuthorizationService implements ResourceAuthorizationService {
  available = true;
  assigned = true;
  active = true;
  currentOwner = true;
  authorizationEpoch = 0;
  redeemCalls = 0;
  readonly issueRequests: IssueResourceGrantRequest[] = [];
  readonly revokedGrantIds: string[] = [];

  private nextGrant = 1;
  private readonly grants = new Map<string, FakeGrant>();

  private requireAuthority(): void {
    if (!this.available) throw new Error("authorization unavailable");
    if (!this.assigned || !this.active || !this.currentOwner) throw new Error("not authorized");
  }

  async issue(request: IssueResourceGrantRequest): Promise<IssuedResourceGrant> {
    this.requireAuthority();
    this.issueRequests.push(structuredClone(request));
    const grantId = `grant-${this.nextGrant++}`;
    const issued: IssuedResourceGrant = {
      grantId,
      token: `mtn2_${grantId}_BEARER_SECRET_MUST_NOT_PERSIST`,
      resource: structuredClone(request.resource),
      rights: [...request.rights],
      ...(request.audience !== undefined ? { audience: request.audience } : {}),
      ...(request.expiresAt !== undefined ? { expiresAt: request.expiresAt } : {}),
    };
    this.grants.set(grantId, {
      issued,
      revoked: false,
      authorizationEpoch: this.authorizationEpoch,
    });
    return structuredClone(issued);
  }

  async inspect(grantId: string): Promise<ResourceGrantSummary> {
    const entry = this.grants.get(grantId);
    if (!entry) throw new Error("unknown grant");
    return {
      grantId,
      resource: structuredClone(entry.issued.resource),
      rights: [...entry.issued.rights],
      ...(entry.issued.audience !== undefined ? { audience: entry.issued.audience } : {}),
      ...(entry.issued.expiresAt !== undefined ? { expiresAt: entry.issued.expiresAt } : {}),
      revoked: entry.revoked || !this.assigned || !this.active || !this.currentOwner ||
        entry.authorizationEpoch !== this.authorizationEpoch,
    };
  }

  async redeem(request: { token: string }): Promise<ResourceAuthorization> {
    this.redeemCalls += 1;
    const entry = [...this.grants.values()].find((candidate) => candidate.issued.token === request.token);
    if (!entry) throw new Error("denied");
    const summary = await this.inspect(entry.issued.grantId);
    if (summary.revoked) throw new Error("denied");
    return {
      grantId: entry.issued.grantId,
      resource: structuredClone(entry.issued.resource),
      rights: [...entry.issued.rights],
      ...(entry.issued.audience !== undefined ? { audience: entry.issued.audience } : {}),
      ...(entry.issued.expiresAt !== undefined ? { expiresAt: entry.issued.expiresAt } : {}),
    };
  }

  async revoke(grantId: string): Promise<void> {
    this.requireAuthority();
    const entry = this.grants.get(grantId);
    if (!entry) throw new Error("unknown grant");
    entry.revoked = true;
    this.revokedGrantIds.push(grantId);
  }

  rotateResourceAuthorizationForTesting(): void {
    this.authorizationEpoch += 1;
  }
}

test("share publishes a snapshot then delegates grant issuance without persisting bearer material", async () => {
  const fs = new MemoryFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, encoder.encode("authorized snapshot"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 4 });
  const authorization = new FakeResourceAuthorizationService();
  const shares = new ResourceAuthorizedShareService(provider, authorization, { now: () => 5000 });

  const created = await shares.share(atom.id, {
    mode: "snapshot",
    rights: ["read"],
    audience: "principal:bob",
    expiresAt: 9000,
  });

  expect(created.record.id).toBe(created.grant.grantId);
  expect(created.record.grantId).toBe(created.grant.grantId);
  expect(created.record.createdAt).toBe(5000);
  expect(created.record.url).not.toContain(created.grant.token);
  expect(authorization.issueRequests).toHaveLength(1);
  expect(authorization.issueRequests[0].resource).toEqual(created.record.resource);

  const redeemed = await authorization.redeem({ token: created.grant.token });
  expect(redeemed.resource).toEqual(created.record.resource);
  expect(redeemed.rights).toEqual(["read"]);

  const persisted = JSON.stringify(store.exportSerializableState());
  expect(persisted).not.toContain(created.grant.token);
  expect(persisted).not.toContain("BEARER_SECRET_MUST_NOT_PERSIST");
  expect(store.stats().revisionCount).toBe(1);
});

test("authorization unavailable fails before publication while unassigned issuance fails without corrupting the snapshot", async () => {
  const fs = new MemoryFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, encoder.encode("complete bytes"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store, { chunkSize: 4 });
  const authorization = new FakeResourceAuthorizationService();
  const shares = new ResourceAuthorizedShareService(provider, authorization);

  authorization.available = false;
  await expect(shares.share(atom.id)).rejects.toBeInstanceOf(SharingAuthorizationUnavailableError);
  expect(store.stats().revisionCount).toBe(0);

  authorization.available = true;
  authorization.assigned = false;
  await expect(shares.share(atom.id)).rejects.toThrow("not authorized");
  expect(store.stats().revisionCount).toBe(1);
  expect(store.stats().resourceCount).toBe(1);

  expect(authorization.issueRequests).toHaveLength(0);
  const revision = await store.getRevision({
    namespace: PLASMON_ATOM_NAMESPACE,
    resourceId: "atom-phase-b",
  });
  expect(revision?.revision).toBe("1");
  expect(revision?.byteLength).toBe(encoder.encode("complete bytes").length);
  const persistedBytes: number[] = [];
  for (const chunk of revision?.chunks ?? []) {
    const bytes = await store.getChunk(chunk.hash);
    expect(bytes).not.toBeNull();
    persistedBytes.push(...(bytes ?? []));
  }
  expect(new TextDecoder().decode(Uint8Array.from(persistedBytes))).toBe("complete bytes");
});

test("revocation and owner/liveness invalidation remain authorization-service truth and do not mutate provider revisions", async () => {
  const fs = new MemoryFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, encoder.encode("stable provider bytes"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store);
  const authorization = new FakeResourceAuthorizationService();
  const shares = new ResourceAuthorizedShareService(provider, authorization);

  const first = await shares.share(atom.id);
  const revisions = store.stats().revisionCount;

  authorization.currentOwner = false;
  await expect(authorization.redeem({ token: first.grant.token })).rejects.toThrow("denied");
  expect(store.stats().revisionCount).toBe(revisions);

  authorization.currentOwner = true;
  authorization.active = false;
  await expect(authorization.redeem({ token: first.grant.token })).rejects.toThrow("denied");
  expect(store.stats().revisionCount).toBe(revisions);

  authorization.active = true;
  await shares.revoke(first.record.id);
  expect(authorization.revokedGrantIds).toEqual([first.grant.grantId]);
  expect((await authorization.inspect(first.grant.grantId)).revoked).toBe(true);
  await expect(authorization.redeem({ token: first.grant.token })).rejects.toThrow("denied");
  expect(store.stats().revisionCount).toBe(revisions);
});

test("stale authorization is rejected by the authorization adapter without changing provider state", async () => {
  const fs = new MemoryFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const atom = await makeAtom(fs, docs.id, encoder.encode("epoch guarded"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store);
  const authorization = new FakeResourceAuthorizationService();
  const shares = new ResourceAuthorizedShareService(provider, authorization);

  const created = await shares.share(atom.id);
  const revisions = store.stats().revisionCount;
  authorization.rotateResourceAuthorizationForTesting();

  await expect(authorization.redeem({ token: created.grant.token })).rejects.toThrow("denied");
  expect((await authorization.inspect(created.grant.grantId)).revoked).toBe(true);
  expect(store.stats().revisionCount).toBe(revisions);
});

test("import fails closed instead of consuming a bearer token without an MTN lease-bound provider call", async () => {
  const fs = new MemoryFs();
  const docs = await fs.mkdir(fs.rootId, "Documents");
  const incoming = await fs.mkdir(fs.rootId, "Incoming");
  const atom = await makeAtom(fs, docs.id, encoder.encode("do not bypass MTN"));
  const store = new MemorySharedResourceStore();
  const provider = new StableSharedResourceProvider(fs, store);
  const authorization = new FakeResourceAuthorizationService();
  const shares = new ResourceAuthorizedShareService(provider, authorization);
  const created = await shares.share(atom.id);

  await expect(shares.importShare(created.grant.token, incoming.id)).rejects.toBeInstanceOf(
    SharingAuthorizationContractMismatchError,
  );
  expect(authorization.redeemCalls).toBe(0);
  expect(await fs.list(incoming.id)).toEqual([]);
  expect(store.stats().revisionCount).toBe(1);
});

// Compile-time tripwires: these stay tests until Coordinator A expands the
// frozen abstraction. If the missing operations/fields appear, this file stops
// typechecking so the fail-closed import path must be revisited.
type MissingMtnServiceOperation = Exclude<"registerProvider" | "call" | "release", keyof ResourceAuthorizationService>;
type MissingLeaseField = Exclude<"leaseId" | "providerScope" | "consumerScope", keyof ResourceAuthorization>;
const missingMtnServiceOperations: readonly MissingMtnServiceOperation[] = ["registerProvider", "call", "release"];
const missingLeaseFields: readonly MissingLeaseField[] = ["leaseId", "providerScope", "consumerScope"];

test("frozen ResourceAuthorizationService still lacks MTN provider registration and lease-bound call surface", () => {
  expect(missingMtnServiceOperations).toEqual(["registerProvider", "call", "release"]);
  expect(missingLeaseFields).toEqual(["leaseId", "providerScope", "consumerScope"]);
});
