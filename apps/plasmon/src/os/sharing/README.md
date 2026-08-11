# Plasmon Shared Resource Provider

Status: **Phase A provider/storage is implemented. Phase B grant/revoke orchestration is implemented against the frozen Plasmon `ResourceAuthorizationService`; lease-bound cross-AppScope provider access remains fail-closed because the frozen abstraction cannot faithfully express the accepted MTN 0.2 call path.**

The accepted MTN dependency reviewed for Phase B is `plasmon-cloud/multitenancy-neutron` at frozen SHA `13a412f40bc0c3571c43bcfb8f0e2133b35ffc3a`. No MTN source is merged, vendored, copied, or reproduced here.

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

The current frozen `contracts/authorization.ts` `ResourceRef` shape remains provisional. `resourceRefBoundary.ts` is the only module that maps the provider's internal identity/revision model to that representation. Provider storage does not persist `providerId`, `ResourceRef.metadata`, MTN AppScope data, grants, rights, audiences, leases, bearer material, authorization epochs, ownership, or liveness state.

The accepted MTN 0.2 authorization identity is the stable tuple:

```text
namespace + resource_id + resource_type
```

MTN derives the provider AppScope from the exact compiler-delivered capability; callers do not select provider/issuer scope. MTN's `ResourceRef` intentionally has no provider revision field. Plasmon's current `ResourceRef` does include a revision so a published snapshot can be addressed exactly. That difference is one of the Phase B contract mismatches documented below; Sharing does not encode the revision into the AtomId/resource id and does not maintain a shadow grant-to-revision authorization database.

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

## Revisions and provider writes

A published resource has monotonically increasing integer revisions represented as strings at the TypeScript boundary.

Publication and provider writes use optimistic compare-and-swap semantics:

```text
commit(resource, expectedRevision, complete replacement content)
  -> new revision
  -> revision conflict
```

There is no CRDT or automatic merge policy. `ProviderResourceHandle.write()` is a complete-resource replacement operation.

`ProviderResourceHandle` is **not** an authorization object. It contains only a provider resource identity. `openInternalResource()` remains provider-internal access and must not be exposed as a cross-AppScope tool.

## Phase B share/grant orchestration

`ResourceAuthorizedShareService` implements the portion of the frozen `ShareService` contract that can be expressed without weakening MTN 0.2.

Share creation is:

```text
require ResourceAuthorizationService.available
    -> provider.publish(node, snapshot)
    -> ResourceAuthorizationService.issue({ resource, rights, audience?, expiresAt? })
    -> CreatedShare { ShareRecord, IssuedResourceGrant }
```

Sharing does not create or hash bearer secrets. The raw token is returned only in the one-time `IssuedResourceGrant` produced by the authorization service.

`ShareRecord` contains no bearer secret. This implementation deliberately uses:

```text
ShareId = grantId
url     = plasmon://share/<grantId>
```

The grant id is not the bearer secret. Using it as `ShareId` lets `revoke(id)` delegate directly to `ResourceAuthorizationService.revoke(grantId)` without maintaining a parallel share-to-grant authority database. Any UI that constructs a transportable bearer link must combine the non-secret record locator with the one-time token transiently and must not persist that bearer value in provider/share storage.

Default share rights are `read`. Explicit rights/audience/expiry values are passed through to the authorization abstraction; Sharing does not implement audience, expiry, rights-subset, ownership, liveness, revocation, delegation, or authorization-epoch policy itself.

If the authorization service is unavailable, `share()` fails before publication. If MTN rejects grant issuance because the provider scope is unassigned, inactive, or no longer owned by the current issuer, the already completed explicit provider snapshot may remain as an ungranted provider revision. That revision has no authorization authority and remains ordinary provider storage.

## Accepted MTN 0.2 authority behavior

At frozen MTN SHA `13a412f40bc0c3571c43bcfb8f0e2133b35ffc3a`:

- `register_provider` is exact-AppScope-bound and requires the physical provider scope to be valid and active, but it does **not** require a tenant assignment/owner. This permits installed+active pool providers to register their callback before allocation.
- Root `issue` is exact-AppScope-bound and requires the provider scope to be valid/active and currently owned. Ownership is revalidated after randomness awaits before the grant is persisted.
- `redeem` validates the bearer token, audience, consumer AppScope activity/ownership, consumer Element restriction, grant usability, and redemption policy, then creates a transient authorization lease.
- Leases contain `lease_id`, subject, consumer scope, provider scope, resource, rights, and expiry. Leases/provider callbacks are transient and are invalidated by restart/upgrade.
- Every `call` revalidates the lease for the exact consumer AppScope and requested right before dispatch. Grant revocation, resource-epoch rotation, provider/issuer liveness changes, ownership changes, ancestry invalidation, consumer ownership/liveness loss, or lease expiry therefore deny later calls.
- The provider callback receives a Kernel-constructed trusted `AuthorizationContext`; provider scope and exact resource are derived from the validated lease rather than caller-selected data.

Sharing does not duplicate any of those checks.

## Fail-closed import and exact Plasmon contract mismatch

The current frozen `ResourceAuthorizationService` is sufficient for root grant issue/revoke orchestration, but it cannot faithfully express the accepted MTN 0.2 provider-use path. `ResourceAuthorizedShareService.importShare()` therefore fails closed with `SharingAuthorizationContractMismatchError` and deliberately does **not** redeem/consume the bearer token.

Calling `authorization.redeem(token)` and then invoking `SharedResourceProvider.importResource(ResourceRef)` directly would be unsafe: the Plasmon authorization result has no live MTN lease handle, and the provider operation would occur outside MTN's per-call revalidation. A grant could be revoked, its resource epoch rotated, or provider/consumer ownership/liveness could change after redemption but before/during a multi-chunk import. Sharing will not create that TOCTOU authorization gap.

The exact frozen-contract mismatches are:

1. **Provider registration is absent.** MTN `AuthorizationCapabilityV1.register_provider(dispatch)` can bind a callback to an active exact provider AppScope before assignment. `ResourceAuthorizationService` has no provider-registration operation, so Agent 9 cannot implement or test the required pre-allocation callback registration through the frozen abstraction.
2. **Lease-bound provider calls are absent.** MTN `AuthorizationCapabilityV1.call({ lease_id, requested_right, operation, payload })` revalidates authority at call time and dispatches a trusted `AuthorizationContext`. `ResourceAuthorizationService` has no equivalent authorized-call operation.
3. **Lease identity/scopes are absent from redemption.** MTN redemption returns `AuthorizationLease` with `lease_id`, `consumer_scope`, `provider_scope`, subject, resource, rights, and expiry. Plasmon `redeem({ token })` returns `ResourceAuthorization` with only grant id/resource/rights/audience/expiry, so Sharing cannot carry a live lease into provider access or release it.
4. **Lease release is absent.** MTN exposes `release({ lease_id })`; `ResourceAuthorizationService` does not.
5. **Pre-auth inspection shapes conflict.** MTN `GrantInspection` deliberately omits exact `resource_id`, provider scope, and issuer scope. Plasmon `inspect(grantId)` requires a `ResourceGrantSummary` containing the complete `ResourceRef`. A faithful Agent 8 adapter cannot populate that field from MTN inspection alone without leaking/fabricating/caching information outside the accepted API.
6. **Snapshot revision is not an MTN resource-authority field.** MTN `ResourceRef` is `{ namespace, resource_id, resource_type }`; Plasmon's provisional `ResourceRef` additionally carries `revision`. The MTN bearer token/lease therefore cannot by itself recover the exact published snapshot revision required by `ShareService.importShare(token, destination)`. Encoding the revision into AtomId/resource id or maintaining a parallel grant-to-revision authority mapping would violate the frozen provider identity/security model.
7. **Additional MTN policy inputs are not represented.** MTN issue/delegate supports structured `GrantAudience`, `consumer_element`, and `max_redemptions`; the frozen generic Plasmon request exposes only `audience?: string`, rights, and expiry. Sharing does not invent mappings for the missing fields.
8. **Delegation/resource rotation are absent.** MTN exposes `delegate` and `rotate_resource`; `ResourceAuthorizationService` does not. Sharing therefore does not implement reshare/delegation or authorization-epoch rotation semantics itself.

Coordinator A/Agent 0 must reconcile these abstractions with Agent 8. The required security property is that a consumer operation reaches the provider only through an MTN-authorized call carrying live lease authority and that snapshot revision selection is transported separately from MTN's stable resource authorization identity without becoming a parallel authorization database.

## Import/copy provider semantics

Phase A `SharedResourceProvider.importResource()` remains an internal provider storage/copy primitive. It downloads and verifies a published revision, then creates a **new local filesystem node** under the requested destination.

For an Atom, the imported local copy receives a new local `atomId`. The original provider identity is retained only as `metadata.sharedSource` provenance:

```text
provider resource identity != imported local NodeId != imported local AtomId
```

This prevents an imported copy from pretending to own or be the provider's original filesystem object. Phase B does not expose this primitive as an authorized cross-AppScope operation until the contract mismatch above is reconciled.

## Implemented

Phase A:

- explicit file/Atom snapshot publication;
- filesystem-revision guard preventing mixed local snapshots;
- immutable AtomId-based provider identity;
- persistent provider records and revisions;
- 1 MiB bounded stable-memory chunks;
- SHA-256 chunk addressing and cross-publication deduplication;
- domain-separated content-root verification;
- optimistic expected-revision writes and stale-revision conflicts;
- verified provider reads/imports;
- versioned stable-memory sharing root and backend methods;
- narrow provisional `ResourceRef` adapter.

Phase B safe subset:

- `ResourceAuthorizedShareService.share()` publication -> authorization issue orchestration;
- `ResourceAuthorizedShareService.revoke()` direct authorization-service delegation;
- token-free `ShareRecord` output with `ShareId == grantId` and no shadow grant database;
- fail-fast behavior when `ResourceAuthorizationService.available` is false;
- fail-closed `importShare()` until MTN lease-bound provider calls are representable;
- focused fake-adapter tests for issue/redemption behavior, unassigned/current-owner/liveness rejection, revocation, stale authorization, provider-revision non-corruption, bearer-secret absence from provider persistence, and the explicit frozen-contract tripwire.

No bearer-secret generation/hashing, token parsing, audience policy, grant persistence, ownership/liveness state, lease issuance/validation, revocation semantics, reshare policy, authorization epochs, cross-AppScope routing, or trusted authorization-context construction is implemented in Sharing.
