# Filesystem agent instructions

## Authority

`fs/**` owns Plasmon filesystem semantics, persistence boundaries, managed-resource policy, projections, Trash/restore support, and filesystem-aware resource opening. UI layers consume this authority.

## Preserve

- Stable node identity across rename/move and other presentation/location changes.
- Hosted durable storage behind the approved background/RPC boundary.
- Atomic commit semantics and monotonic revision behavior.
- Versionable, idempotent bootstrap/reconciliation that preserves user-owned state.
- Centralized resource classification/protection; generic consumers must not bypass it through private storage access.
- Shared resource opening/shortcut resolution rather than per-surface dispatch tables.
- A clear distinction between durable product initialization and temporary demo/fixture data.
- `/System/Program Files` is a Filesystem-managed curated runtime/resource location, not Neutron installation authority. Runtime owners consume the shared Program Files seam and retain semantics for their own subtrees; do not infer `.sys` applications from Program Files entries.

Representation-specific rules belong in the contracts/policy implementation and focused tests. Do not promote a particular suffix, seeded item, compatibility exception, or current bug into generic instructions unless it is an enduring filesystem invariant.

## Refactor direction

Prefer small policy/services around one filesystem authority. Separate storage/repository mechanics from managed-resource policy, projection reconciliation, Trash, and opening logic. If a UI needs new filesystem semantics, add them to the owning production service/model instead of teaching the UI to infer storage state.

## Tests

Keep deterministic coverage for identity, revision/atomicity, naming, protected operations, migration/reconciliation, projections, Trash, shortcut/open resolution, persistence, and RPC behavior. Use packaged/browser tests only where browser storage/background transport or visible cross-surface behavior is material.

Escalate persistent representation/schema changes and shared-contract changes before implementation.
