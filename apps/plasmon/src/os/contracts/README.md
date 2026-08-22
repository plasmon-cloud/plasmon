# OS contracts

<!-- plasmon-docs-review:v1 sha256=39878d53c54e419adab95063248439b79c888cb8ef16d7cfd1091f5f6aa94c5a base=0c9f91b341800f91113aeb269a6438165eb825c8 -->

This directory defines the public TypeScript interfaces and stable identifiers shared by Plasmon OS subsystems. It is the vocabulary boundary between filesystem, associations, native applications, process/windowing, Neutron integration, authorization/sharing, backup, and composition.

Contracts describe capabilities and identities. They should not contain React UI, concrete repositories, browser-storage choices, Kernel transport code, or subsystem orchestration.

## Contract families

- `common.ts` — identifiers and cross-cutting value types.
- `fs.ts` — filesystem nodes, service operations, events, metadata, and stable node identity.
- `apps.ts` — native application metadata.
- `associations.ts` — handlers, rules, matching/opening contracts, and logical resource descriptors.
- `process.ts` / `window.ts` — Plasmon-local process and window lifecycle, including Windowing-owned current-focus/MRU snapshots.
- `neutron.ts` — the narrow Plasmon-facing Kernel bridge.
- `authorization.ts` / `sharing.ts` — generic authorization/sharing seams.
- `backup.ts` — backup capability seam.

## Design direction

A contract should exist because multiple components need a stable shared capability, not because one implementation wants to expose its internals. Prefer narrow contracts, stable identities, and compatibility-preserving additions. Keep application-specific policy in the owning subsystem.

Contract changes are cross-subsystem changes: audit implementations, fakes, adapters, consumers, persisted representations, and tests before changing semantics.
