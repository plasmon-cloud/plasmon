# Atom and collaboration design index

<!-- plasmon-docs-review:v1 sha256=62c1cf76a66fa14f146c8cb8ba03c5eb0254ea251fc796ff9e257da41497592b base=2f895e1b9df52cd127020356f00989dc08c8a25e -->

This directory contains the long-form design record for Plasmon's logical Atom model and the first collaborative Atom work.

## Read in this order

1. [`FIRST_COLLABORATIVE_ATOM_DESIGN.md`](FIRST_COLLABORATIVE_ATOM_DESIGN.md) — broad architecture, terminology, state/revision model, collaboration boundaries, and Review-oriented design exploration.
2. [`FIRST_COLLABORATIVE_ATOM_MVP.md`](FIRST_COLLABORATIVE_ATOM_MVP.md) — narrowed/frozen MVP constraints and redlines intended to keep the first implementation economically and architecturally viable.

The current explicit task and nearest scoped `AGENTS.md` still outrank these documents when they intentionally change a decision; material conflicts should be surfaced and the durable docs updated.

## Frozen mental model

An **Atom** is an application-defined, independently addressable logical resource. A physical installation of one Element may own many Atoms.

Therefore:

```text
Atom != physical Neutron application instance
Atom != AppScope
Atom != process/window
Atom != filesystem path
Atom != RevisionId
```

A workspace or tile is a view of logical resources and must not imply allocation of another physical Neutron app instance.

## Revisions

One accepted semantic application transaction produces one logical revision. `RevisionId` identifies that logical history point; it does not prescribe its physical encoding as a full snapshot, Git commit, Merkle root, chunk manifest, or provider publication.

For live structured Atoms, mutation cost should be proportional to the records/state actually changed plus small revision bookkeeping. Restoring an older logical state creates a new current revision rather than rewinding identity/history in place.

## Live state versus immutable publication

Do not turn immutable snapshot/chunk publication into the hot persistence path for every collaborative edit. Snapshots remain appropriate for exports, archives, attachments, backups, immutable file/blob publication, and similar boundaries.

The current generic `SharedResourceProvider` contract in `src/os/contracts/sharing.ts` is snapshot-oriented. That contract is appropriate for the resource publication behavior it currently describes; it should not be misread as requiring a live structured Atom database to serialize/publish its complete state on every semantic mutation.

## Authorization boundary

Atom/application providers own their domain semantics, logical state, revisions, and publication/storage choices. MTN authorization owns cross-AppScope grants, bearer-secret handling, rights/audience, leases, revocation, authorization epochs, reshare policy, and routing.

Do not move application semantics into MTN, and do not reimplement MTN's authorization policy inside Atom providers.

## Implementation status

These are architecture/design documents, not proof that a generic collaborative Atom runtime is already implemented. Before implementing from them, inspect the current contracts/code and identify which pieces are design-only, already integrated, or awaiting a dedicated implementation wave.
