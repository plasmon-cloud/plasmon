# Plasmon backend

<!-- plasmon-docs-review:v1 sha256=a1c96f6a6774583c3e2ea4d843dc773ca51fd64e89d773ba9aa24b14f68f2871 base=2f895e1b9df52cd127020356f00989dc08c8a25e -->

This directory contains the Motoko backend packaged with the Plasmon Neutron application.

The backend currently exposes the original `hello_world` method plus the Sharing provider's same-AppScope stable-storage methods. The browser-local Plasmon filesystem is **not** implemented here. In Kernel-hosted Plasmon, filesystem persistence remains owned by the app's persistent background surface and the filesystem RPC/repository code under `../src/os/fs/`.

## Ownership

This directory owns:

- Plasmon Motoko application methods declared by `../neutron.json`;
- managed-memory schema modules used by the backend;
- backend migrations when a released managed-memory schema must evolve;
- Sharing provider chunk/revision persistence and backend integrity checks.

It does not own Desktop filesystem semantics, `.neutron` projections, native application state, Atom application-domain semantics, or cross-AppScope sharing authorization.

## Persistence

Released managed-memory source is immutable history. If backend durable state changes, add a new schema version and explicit forward migrations as required by the repository-level `AGENTS.md` and `/doc/memory-migrations-and-uninstall.md`.

Current managed-memory roots are:

- `memory/hello/v1.mo` — the original example state;
- `memory/sharing/v1.mo` — Sharing provider schema v1 for content-addressed chunks and immutable published resource revisions.

`sharing/Sha256.mo` verifies chunk hashes and provider content-root manifests. The Sharing methods in `main.mo` are provider-storage primitives only; they are not MTN authorization endpoints and do not contain bearer, grant, lease, ownership, liveness, AppScope-routing, or authorization-epoch state.

Do not move browser-local filesystem data into managed Motoko memory merely to avoid the existing background-service contract.

## Related files

- `../neutron.json` — package methods, memory declarations, background surface.
- `../src/os/fs/` — Plasmon filesystem implementation.
- `../src/os/sharing/` — Sharing provider/storage and bounded authorization orchestration.
- `../../doc/` — Neutron backend/package/migration authority.
