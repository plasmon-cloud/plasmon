# Atom and collaboration architecture

This directory is the current cross-subsystem index for Plasmon's logical Atom model. Historical collaborative-Atom research and hackathon scope documents are preserved under [`../history/`](../history/); they are useful design provenance but are not required current authority.

## Current mental model

An **Atom** is an application-defined, independently addressable logical resource. A physical installation of one Element may own many Atoms.

Therefore:

```text
Atom != physical Neutron application instance
Atom != AppScope
Atom != process/window
Atom != filesystem path
Atom != RevisionId
```

A workspace, tile, process, or window is a view/execution context for logical resources and must not imply allocation of another physical Neutron application merely to manufacture Atom identity.

The owning Element defines its Atom type, state model, commands, import/export behavior, and storage representation. Plasmon provides shared OS/runtime capabilities; it does not impose one universal application-data schema.

## Revisions

One accepted semantic application transaction produces one logical revision when the owning Atom type supports revision history. `RevisionId` identifies that logical history point; it does not prescribe a physical encoding as a full snapshot, Git commit, Merkle root, chunk manifest, or provider publication.

For live structured Atoms, mutation cost should be proportional to the state actually changed plus bounded revision bookkeeping. Restoring an older logical state should create a new current revision rather than rewinding identity/history in place.

## Live state versus immutable publication

Do not turn immutable snapshot/chunk publication into the hot persistence path for every collaborative edit. Snapshots remain appropriate for exports, archives, attachments, backups, immutable file/blob publication, and similar boundaries.

The generic Sharing provider contract is snapshot-oriented where its resource publication behavior requires snapshots. That must not be interpreted as requiring every live structured Atom database to serialize/publish its complete state on every semantic mutation.

## Authorization boundary

Atom/application providers own their domain semantics, logical state, revisions, and publication/storage choices. MTN authorization owns cross-AppScope grants, bearer-secret handling, rights/audience, leases, revocation, authorization epochs, reshare policy, and routing.

Do not move application semantics into MTN, and do not reimplement MTN authorization policy inside Atom providers.

For current Sharing implementation and the fail-closed MTN boundary, read [`../../src/os/sharing/README.md`](../../src/os/sharing/README.md) and the current sharing contracts under `src/os/contracts/`.

## Implementation status

This document defines the durable logical distinctions used by Plasmon documentation. It does **not** claim that a generic collaborative Atom runtime or the historical Review design is fully implemented.

Before implementing Atom-specific behavior:

1. inspect the current owning Element/application contracts and storage model;
2. inspect the current Plasmon Sharing/MTN boundary if cross-AppScope access is required;
3. keep Atom identity separate from AppScope/process/window/path/revision identity;
4. define typed application-domain operations rather than treating a transport/storage representation as the semantic API;
5. update current contracts/docs when a new durable cross-subsystem invariant is accepted.

## Historical design provenance

The original collaborative Review/Atom research and the narrowed hackathon MVP scope are preserved verbatim as history:

- [`../history/FIRST_COLLABORATIVE_ATOM_DESIGN.md`](../history/FIRST_COLLABORATIVE_ATOM_DESIGN.md)
- [`../history/FIRST_COLLABORATIVE_ATOM_MVP.md`](../history/FIRST_COLLABORATIVE_ATOM_MVP.md)

Those documents contain historical branch/SHA, coordinator, candidate-technology, and hackathon-scope decisions. Use them for provenance/research context, not as a substitute for current implementation or contracts.
