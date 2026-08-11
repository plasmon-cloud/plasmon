# Dependency and integration requests

No new npm dependency is required for the MTN 0.2 adapter boundary.

The authoritative authorization implementation remains external repository `plasmon-cloud/multitenancy-neutron` at accepted SHA `13a412f40bc0c3571c43bcfb8f0e2133b35ffc3a`. Do not vendor, copy, merge, or cherry-pick that repository into Plasmon.

## Coordinator A contract reconciliation required

The frozen Plasmon `ResourceAuthorizationService` cannot currently represent the accepted MTN 0.2 surface without losing security-significant information:

1. Plasmon `ResourceRef` is `{ providerId, resourceId, revision, metadata? }`; MTN authorization resource identity is `{ namespace, resource_id, resource_type }`. MTN does not carry the Plasmon provider revision in grants/leases, so the adapter cannot reconstruct the frozen `ResourceRef` on inspect/redeem without inventing a shadow mapping.
2. Plasmon `redeem({ token })` has no exact consumer AppScope. MTN `kernel_authorization_redeem` requires `{ token, consumer_scope }` and validates authenticated-principal ownership, liveness, and consumer Element policy for that exact AppScope.
3. MTN redemption returns an `AuthorizationLease` whose `lease_id` is required by bound `call`, `delegate`, and `release`. Frozen Plasmon `ResourceAuthorization` has no lease handle. Silently discarding it would make the accepted authorized-call lifecycle impossible to represent without hidden adapter state.
4. Plasmon `expiresAt` is a JavaScript `number` with no frozen unit/encoding contract. MTN grant/lease timestamps are `Nat64` values derived from `Time.now()` nanoseconds. Epoch-nanosecond values exceed JavaScript's safe-integer range, so the adapter must not coerce them without an approved representation/unit decision.
5. Plasmon `inspect(grantId)` requires a full `ResourceGrantSummary`, including the exact resource and audience. MTN's public `kernel_authorization_inspect` is intentionally safe pre-authentication metadata and omits exact `resource_id`, provider/issuer scope, audience, bearer material, and storage details.

Coordinator A should make one deliberate contract reconciliation rather than scattering translation or hidden state through Sharing/Neutron code.

## Exact-AppScope backend transport required

Accepted MTN 0.2 exposes only these authorization methods as general Kernel actor methods:

- `kernel_authorization_capabilities`;
- `kernel_authorization_inspect`;
- `kernel_authorization_redeem`.

Issuer/provider/consumer authority is instead delivered by the compiler as backend `AuthorizationV1`, permanently bound to the app installation's exact AppScope. It contains:

- `issue`;
- `list`;
- `revoke`;
- `rotate_resource`;
- `register_provider`;
- `call`;
- `delegate`;
- `release`.

The current Plasmon package does not request `backend.capabilities.authorization = { api: 1 }`, and the current Plasmon browser transport does not expose a sanctioned bridge to those bound backend methods. Integration therefore needs a narrow backend capability/wrapper design before Agent 8 can enable production `ResourceAuthorizationService` behavior.

Do not replace this with a TypeScript-selected AppScope or direct arbitrary Kernel call. The compiler-bound exact scope is part of MTN's security model.

Provider registration must preserve MTN's pre-allocation lifecycle: an installed/active exact provider AppScope may register its callback while unassigned. Registration alone grants no authority. Issue/list/revoke/rotate/call/delegate continue to rely on MTN's current ownership/liveness checks.

## Existing vanilla Neutron dependencies

The bridge continues to reuse the app's existing `neutron-tools` runtime dependency for `apps.list`, `apps.describe`, `apps.install_offer`, `endpoints.list`, `workspace.open_tile`, and package-local app URL resolution.

Agent 8 has not changed any package, lockfile, manifest, Kernel source, frozen contract, Sharing code, or integration composition in this phase.
