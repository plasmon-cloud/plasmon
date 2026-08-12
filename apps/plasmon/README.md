# Plasmon

Plasmon is the user-facing desktop and application environment running on Neutron. It is packaged as a normal Neutron application and does not replace the Kernel. Neutron remains authoritative for installation, AppScope isolation, capabilities, package execution, and Kernel security.

## Product direction

Plasmon is intended to become a complete desktop environment rather than a launcher or demo shell. daedalOS is the primary feature-completeness reference; Windows and macOS are interaction and usability references. Reference behavior is an input, not an architecture: Plasmon should reproduce useful desktop capabilities through Plasmon/Neutron authorities instead of importing another project's process, storage, or application model.

The long-term direction is one coherent OS implementation with reusable services and native applications. Temporary compatibility code, duplicated launch paths, proof-of-concept shells, and demo-only startup behavior should converge into the canonical architecture rather than becoming permanent parallel systems.

## Mental model

- **Neutron** — Kernel/runtime substrate.
- **Element** — an application/package.
- **Isotope** — a variant, version, or runtime profile of an Element.
- **Atom** — an app-defined, independently addressable logical unit. A physical Element installation may own many Atoms.
- **NodeId** — the stable identity of a filesystem node; path and display name are mutable presentation.

Do not infer identity or ownership from a filename suffix, window, process, path, or storage representation. Those mappings belong to the relevant contracts and subsystem policy.

## Architecture

The active frontend path is:

```text
src/index.tsx
  -> src/os/PlasmonOS.tsx
  -> src/os/integration/services.ts
  -> Shell + Desktop + native process/window host
```

Primary code lives under [`src/os/`](src/os/):

- `contracts/` — shared subsystem interfaces and identifiers.
- `fs/` — filesystem authority, persistence boundary, bootstrap/reconciliation, projections, resource policy, and shared opening support.
- `associations/` — handler registration, matching/defaults, and Open With models.
- `process/` and `windowing/` — Plasmon-local native application lifecycle and window management.
- `desktop/` and `file-manager/` — filesystem presentation and interaction.
- `shell/` — Start, Search, taskbar, tray, flyouts, and shell preferences.
- `neutron/` — adapter to verified Neutron capabilities.
- `integration/` — service composition and cross-subsystem wiring.
- `sharing/` — explicit shared-resource snapshot/provider storage and the bounded share/revoke orchestration that remains separate from MTN authorization authority.
- `visual/` — shared visual primitives, presentation tokens, and resource artwork composition.

Native applications and association-backed runtime hosts live under [`src/native-apps/`](src/native-apps/).

Legacy-looking source at the top of `src/` and under compatibility directories is not automatically active architecture. Check imports from the packaged entrypoint before using it as precedent.

## Refactor direction

Prefer refactors that reduce duplicate authority and make user actions testable below React:

1. keep stateful product semantics in services, controllers, models, or commands;
2. keep React components focused on rendering, event translation, and composition;
3. route generic resource operations through shared filesystem/association/open services;
4. keep Kernel-facing behavior behind the Neutron adapter;
5. retire legacy/compatibility paths after their remaining useful behavior has been migrated and verified;
6. remove temporary demo/bootstrap behavior from normal startup once it is no longer product behavior;
7. consolidate shared visual, interaction, and metadata rules rather than growing per-surface variants.

Large refactors should be decomposed into independently verifiable issues. README/AGENTS files describe the durable target and ownership; concrete defects, migrations, and acceptance details belong in Issues and tests.

## Development and verification

Install repository dependencies once from the repository root:

```sh
npm ci
```

Use focused Bun tests while iterating, then the Plasmon fast lane:

```sh
npm --workspace neutron-plasmon test
```

For package/build changes, additionally run:

```sh
npm --workspace neutron-plasmon run test:package
```

For both lanes:

```sh
npm --workspace neutron-plasmon run test:all
```

See [`TESTING.md`](TESTING.md) for the canonical matrix.

The testing goal is layered confidence, not maximum browser coverage. Keep deterministic semantics in fast unit/integration tests. Use a real browser for behavior that actually depends on the DOM, focus/pointer events, workers, media/iframe behavior, packaged assets, or installed Neutron integration. Manual review remains necessary for visual quality and interaction feel that automation cannot establish.

A source-level implementation is not product acceptance when the user-visible path depends on packaging or browser behavior.

## Documentation

Start with:

- [`AGENTS.md`](AGENTS.md) — scoped implementation rules.
- [`TESTING.md`](TESTING.md) — test protocol and CI lanes.
- [`docs/README.md`](docs/README.md) — accepted architecture/design index.
- [`src/README.md`](src/README.md) — active frontend layout and legacy boundaries.
- [`src/os/README.md`](src/os/README.md) — OS subsystem map.

Repository-level Neutron documentation under [`../../doc/`](../../doc/) remains authoritative for Kernel behavior.
