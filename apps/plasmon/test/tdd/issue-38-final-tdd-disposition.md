# Issue #38 — final TDD disposition

Audit release: `origin/release/0.1.0-r2` at
`8cfb4d68414b271303bd0afefdcac9dc8449c315`.

## Final disposition

**EXTERNAL / COORDINATOR BOUNDARY**

#38 is terminally classified for Luna TDD purposes. It is not a Luna RED,
and it is not promoted as complete live cross-AppScope sharing. The current
release contains the approved Phase-A provider/storage behavior and the safe
root grant/revoke subset. The current frozen authorization contract cannot
express the future live MTN lease-bound provider call path; `importShare()`
therefore remains deliberately fail-closed.

The remaining acceptance evidence is external Coordinator/Sharing/Backend/
Neutron work, not a reason to retain a Luna queue claim:

- **Product implementation:** Phase-A provider/storage and safe authorization
  subset are present; no Luna product change is required.
- **CI/integration evidence:** current package/backend/durable-memory and
  required Neutron/authorization specialist evidence must be recorded by the
  external owner for the Sharing change.
- **Documentation/review evidence:** current-head handoff/review packet and
  durable-state/security review remain external-owner obligations.
- **External Neutron/MTN dependency:** live provider-call/lease redemption is
  not expressible through the frozen `ResourceAuthorizationService`.

## PRESERVE

- Immutable provider/snapshot storage semantics.
- Chunking, SHA-256 integrity, revision consistency, and stable-memory schema.
- Token-free persisted `ShareRecord`.
- Existing generic authorization boundary where faithfully expressible.
- Revoke delegation to `ResourceAuthorizationService`.
- Fail-closed import while live MTN provider-call semantics are unavailable.
- No bearer-secret persistence.
- No shadow MTN authorization database.
- No direct cross-AppScope provider access.
- No CRDT/live collaboration invention.

Current release evidence includes:

- `apps/plasmon/src/os/sharing/provider.test.ts`
- `apps/plasmon/src/os/sharing/shareService.test.ts`
- `apps/plasmon/src/os/sharing/snapshot-consistency.test.ts`
- `apps/plasmon/src/os/sharing/resourceType.test.ts`
- `apps/plasmon/src/os/sharing/README.md`
- `apps/plasmon/src/os/sharing/DEPENDENCIES.md`
- `apps/plasmon/backend/memory/sharing/v1.mo`
- `apps/plasmon/backend/sharing/Sha256.mo`

These cover publication, immutable identity/type, chunk and content-root
integrity, revision/CAS behavior, snapshot consistency, restart/schema
behavior, token-free persistence, revoke delegation, authorization invalidation,
and fail-closed import.

## CHANGE

No Luna TDD change is authorized or required by the current #38 contract.
External Sharing/Backend/Coordinator ownership may add only the package,
backend, memory, security-review, and documentation evidence required by the
Issue. It must not weaken fail-closed import or expand this Issue into live
collaboration or a new authorization model.

## UNSPECIFIED

Future live MTN redemption/provider-call architecture is unspecified and not
claimable by Luna. In particular, the frozen interface does not provide the
lease identity, provider/consumer scopes, per-call revalidation, or a separate
snapshot-revision locator required for safe live import. Resolving that
boundary requires Neutron/MTN/Coordinator authority.

## Queue action

The prior `claimed:coordinator` queue state is released and finalized as an
external boundary disposition. This packet is the TDD evidence for marking
#38 terminal; it does not close the GitHub Issue or claim live sharing works.
