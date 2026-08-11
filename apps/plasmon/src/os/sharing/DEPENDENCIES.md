# Sharing integration dependencies

Phase A adds no npm/Mops/package dependencies and does not require lockfile changes.

The provider requires the following Plasmon backend/manifest wiring so its storage survives upgrades and can be reached through Neutron same-AppScope self-calls:

- `backend/memory/sharing/v1.mo` — immutable stable-memory schema v1;
- `backend/sharing/Sha256.mo` — backend SHA-256/content-root verification;
- `backend/main.mo` — sharing storage methods and `stable_memory.sharing` environment root;
- `neutron.json` — sharing memory root and backend method declarations.

These are integration-affecting edits required by the explicitly assigned stable-memory provider work. No shared package or lock files are modified.

## Phase B MTN dependency

Authoritative MTN 0.2 dependency:

```text
repository  plasmon-cloud/multitenancy-neutron
branch      version-0.2.0
frozen SHA  13a412f40bc0c3571c43bcfb8f0e2133b35ffc3a
```

Agent 9 does not add MTN as a source/package dependency and does not merge, cherry-pick, vendor, or reproduce MTN implementation code. Phase B Sharing code consumes only the frozen Plasmon `ResourceAuthorizationService` abstraction.

The current abstraction supports the safe subset used by `ResourceAuthorizedShareService`:

- `available`;
- `issue(...)`;
- `revoke(grantId)`.

## Coordinator reconciliation required

The accepted MTN 0.2 provider-use path cannot be represented faithfully by the current frozen Plasmon authorization contracts. Coordinator A/Agent 0 must reconcile these exact mismatches with Agent 8 before authorized cross-AppScope read/write/import can be enabled:

1. MTN `AuthorizationCapabilityV1.register_provider(dispatch)` has no `ResourceAuthorizationService` equivalent. This operation is required to register an active physical provider callback before tenant assignment.
2. MTN `AuthorizationCapabilityV1.call({ lease_id, requested_right, operation, payload })` has no equivalent. Provider access must continue to revalidate a live lease on every operation rather than trust a redeemed snapshot of rights.
3. MTN `AuthorizationLease` exposes `lease_id`, subject, `consumer_scope`, `provider_scope`, resource, rights, and expiry. Plasmon `ResourceAuthorization` omits lease/scopes, so a redeemed result cannot be carried into MTN provider dispatch.
4. MTN `release({ lease_id })` has no `ResourceAuthorizationService` equivalent.
5. MTN `GrantInspection` intentionally omits exact `resource_id` and provider/issuer scopes; Plasmon `ResourceGrantSummary` requires the complete `ResourceRef`. Agent 8 cannot faithfully implement the current inspect result from MTN inspection alone without extra/leaky/fabricated state.
6. MTN authorization `ResourceRef` is `{ namespace, resource_id, resource_type }` and deliberately has no provider revision. Plasmon's provisional `ResourceRef` includes `revision`, while `ShareService.importShare(token, destination)` receives no separate revision locator. Do not encode the revision into AtomId/resource id or create a parallel grant->revision authorization map.
7. MTN issue/delegate additionally models structured `GrantAudience`, `consumer_element`, and `max_redemptions`; the current generic Plasmon issue request does not expose those fields.
8. MTN `delegate` and `rotate_resource` are not represented. Sharing must not reproduce delegation, reshare, or authorization-epoch policy locally.

Until that reconciliation lands, `ResourceAuthorizedShareService.importShare()` intentionally fails closed before bearer redemption rather than consume a lease that Sharing cannot safely use/release.
