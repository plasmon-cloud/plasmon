# Plasmon Shared Resource Provider

Status: **Phase A provider/storage implementation. MTN orchestration is intentionally not implemented yet.**

## Local-first boundary

Plasmon's filesystem remains browser-local by default. Creating, editing, renaming, or moving a local file/Atom does not publish it and does not write to ICP stable memory. Publication happens only when `SharedResourceProvider.publish()` is explicitly invoked.

The provider snapshots one resource at a time. It is not a browser/cloud filesystem synchronizer and it does not watch filesystem change events.

An explicit publication is guarded by the filesystem's global `FsService.revision()`. The provider captures that revision before reading the source `FsNode`, derives resource identity and snapshot metadata from that guarded `stat()`, reads/hashes all ranged content, then verifies the filesystem revision is unchanged before committing a provider revision. If the filesystem changes during snapshot construction, publication fails and no provider resource revision is committed. This guard covers payload changes as well as rename/move/metadata/Atom identity changes during the attempt.

## Resource identity

Provider persistence is independent of filesystem paths.

Atoms use:

```text
namespace    = plasmon.atom
resourceId   = immutable AtomId
resourceType = Atom atomType, for example notepad2/v1
```

Ordinary files use the immutable filesystem `NodeId` under the separate `plasmon.file` namespace. The path, parent, and local source `NodeId` are not stored in an Atom's provider identity, so rename/move operations do not invalidate a published Atom.

The current frozen `contracts/authorization.ts` `ResourceRef` shape is provisional. `resourceRefBoundary.ts` is the only module that maps the provider's internal identity/revision model to that representation. Provider storage does not persist `providerId`, `ResourceRef.metadata`, MTN AppScope data, grants, rights, audiences, leases, bearer material, or authorization epochs.

## Persistence model

Provider schema version 1 stores three concepts:

```text
sharing root
  schemaVersion
  chunks[]
    sha256 -> bytes
  resources[]
    namespace + resourceId
    resourceType
    currentRevision
    revisions[]
      revision
      byteLength
      contentRootHash
      ordered chunk refs (sha256 + size)
      snapshot presentation/type metadata
      createdAt
```

The Plasmon backend declares this as an independent versioned stable-memory root in `backend/memory/sharing/v1.mo`. Once released, that schema file should be treated as immutable. A future incompatible format should add a new schema version plus an explicit Neutron memory migration rather than changing v1 in place.

`MemorySharedResourceStore` mirrors these semantics for focused tests and can be recreated over the same state to exercise restart/persistence behavior.

## Chunk format and deduplication

Production publication uses fixed chunks up to **1 MiB**. The browser provider reads the local filesystem with ranged reads and never requires a large resource to cross the Neutron boundary as one JSON value.

Each chunk is addressed by lowercase SHA-256. Before upload, the provider asks whether that digest already exists. Identical bytes therefore reuse one stored chunk across repeated publications and across resources.

Chunk uploads can occur before the final filesystem-revision check and provider revision CAS. Therefore an aborted concurrent publication can leave content-addressed chunks that are not referenced by any committed resource revision. Phase A does not implement chunk refcounts or garbage collection for these orphaned chunks. This is an MVP storage-reclamation/storage-cost limitation only; such chunks do not permit an inconsistent provider revision to be committed and remain subject to normal hash verification if later reused.

`NeutronStableMemorySharingTransport` uses Neutron's binary `querySelf` / `updateSelf` path, so chunk bytes travel as binary self-call fields rather than base64 inside the generic JSON tool bus.

## Integrity model

Integrity is checked at every storage boundary:

1. the publishing frontend computes SHA-256 for each chunk;
2. the backend recomputes SHA-256 before accepting a chunk;
3. a revision commit verifies that every referenced chunk exists and still matches its digest and expected size;
4. revisions carry a domain-separated SHA-256 content root over byte length plus the ordered `(chunk hash, chunk size)` manifest;
5. reads/imports re-verify chunk hashes and the content root instead of trusting stored locators;
6. explicit filesystem publication verifies the global filesystem revision did not change between the start of the guarded snapshot attempt and completion of its metadata/content reads.

Corrupt content fails closed with an integrity error. A concurrent local filesystem mutation fails the publication before provider revision commit with a source-changed integrity error.

## Revisions and writes

A published resource has monotonically increasing integer revisions represented as strings at the TypeScript boundary.

Publication and provider writes use optimistic compare-and-swap semantics:

```text
commit(resource, expectedRevision, complete replacement content)
  -> new revision
  -> revision conflict
```

There is no CRDT or automatic merge policy. `ProviderResourceHandle.write()` is a complete-resource replacement operation suitable for later use behind MTN-authorized writes.

`ProviderResourceHandle` is **not** an authorization object. It contains only a provider resource identity. `openInternalResource()` is provider-internal access and must not be exposed as a cross-AppScope tool. Phase B must create/bind such a resource-scoped operation only after the Kernel/MTN supplies trusted authorization context and verifies the requested right.

## Read operations

The backend provides same-AppScope storage methods for schema inspection, chunk existence/upload/retrieval, resource description, revision lookup, and resource-scoped chunk reads. These are storage primitives for Plasmon itself; they are not an insecure generic cross-tenant provider API.

The future MTN authorized call path must derive the provider AppScope, resource identity, and rights from Kernel-trusted context. Caller-supplied `rights`, provider scope, or resource authorization identity must never become trusted security context.

## Import/copy

`importResource()` downloads and verifies a published revision, then creates a **new local filesystem node** under the requested destination.

For an Atom, the imported local copy receives a new local `atomId`. The original provider identity is retained only as `metadata.sharedSource` provenance:

```text
provider resource identity != imported local NodeId != imported local AtomId
```

This prevents an imported copy from pretending to own or be the provider's original filesystem object.

## Implemented in Phase A

- explicit file/Atom snapshot publication;
- filesystem-revision guard preventing mixed local snapshots;
- immutable AtomId-based provider identity;
- persistent provider records and revisions;
- 1 MiB bounded stable-memory chunks;
- SHA-256 chunk addressing and cross-publication deduplication;
- domain-separated content-root verification;
- optimistic expected-revision writes and stale-revision conflicts;
- verified reads and imports;
- resource-scoped provider operation handle for future authorization binding;
- versioned stable-memory sharing root and backend methods;
- narrow provisional `ResourceRef` adapter;
- focused tests for publication, dedupe, multi-chunk data, concurrent payload/Atom metadata mutation, integrity failure, identity/path independence, revisions, persistence/schema handling, malformed refs, import/copy, and absence of capability material from provider persistence.

## MTN 0.2 integration still blocked

Phase A deliberately does **not** implement `ShareService` grant/lease orchestration. The following must wait for Agent 0's handoff of the actually shipped MTN 0.2 API:

1. replace/adjust the provisional mapping in `resourceRefBoundary.ts` to the Agent-0-approved MTN `ResourceRef` boundary;
2. add the high-level `ShareService` implementation that composes `provider.publish()` with MTN grant issuance;
3. bind MTN's trusted `AuthorizationContext` to provider `describe`/`read`/`write` operations and enforce rights from that trusted context;
4. wire grant inspection, redemption, consumer Element/AppScope selection, lease handling, and revocation through the MTN adapter owned by the integration/Neutron boundary;
5. wire the completed provider into `src/os/integration/services.ts` after the real filesystem service and MTN adapter are integrated.

No bearer-secret generation/hashing, token parsing, audience policy, grant creation, lease validation/issuance, revocation semantics, reshare policy, authorization epochs, cross-AppScope routing, or trusted authorization-context construction belongs in this directory.
