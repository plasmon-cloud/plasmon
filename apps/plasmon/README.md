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

Do not infer identity or ownership from a filename suffix, window, process, path, or storage representation. Those mappings belong to the relevant contracts and subsystem policy. See [`docs/GLOSSARY.md`](docs/GLOSSARY.md) for the shared terminology and identity distinctions used across Plasmon.

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

### Package and runtime configuration model

Plasmon's durable distribution model separates **package tier**, **Demo content**, and **optional heavyweight runtimes**. Do not create a new package-tier name merely to select a runtime or demo dataset.

- **Slim** — the permanently constrained Plasmon package. It is a normal installable Plasmon environment with Text, Markdown, Monaco editor/base assets, and only `editor.worker.js`. It excludes the dedicated JSON/CSS/HTML/TypeScript Monaco workers, js-dos, EmulatorJS, Games runtime/library roots, ROM/`.jsdos`/`.dosz` payloads, and Demo-only content. Its emitted `.neutron` must remain **strictly less than 1,900,000 bytes**.
- **Base** — the ordinary/default Plasmon package tier. It contains normal product features, including the complete Monaco language-service worker set and theming, without the Slim byte ceiling, while still excluding heavyweight optional runtimes and game payloads by default.
- **Demo** — Base plus explicit demo/bootstrap content. Demo is an overlay/setup concern, not another package capability tier. It may select showcase sibling applications through a deployment manifest and may later select optional runtime dependencies and legal demo games through the runtime-configuration mechanism; those assets do not become unconditional Base content.
- **Runtime configuration** — an orthogonal, declarative selection of optional heavyweight capabilities such as js-dos, EmulatorJS, and associated pinned content. A custom runtime configuration is data/configuration, not a new package tier or source-code fork.

Package-tier parsing is finite and fail-closed. `PLASMON_PACKAGE_PROFILE` accepts only `base` and `slim`; an unset ordinary build resolves to `base`. Demo content is selected separately with `PLASMON_DEMO_OVERLAY=1`. Enabling the Demo overlay for Slim is invalid.

Production package commands are:

```sh
npm --workspace neutron-plasmon run package:base
npm --workspace neutron-plasmon run package:demo
npm --workspace neutron-plasmon run package:slim
```

`package:demo` is Base plus the Demo overlay. It does not introduce a third package tier. The package tier controls what is inside `plasmon.v0.1.0.neutron`; `.ndeploy.json` manifests independently control which sibling `.neutron` applications are installed alongside Plasmon.

The deterministic Base package test is:

```sh
npm --workspace neutron-plasmon run test:package:base
```

The production Slim command first audits the final generated `dist/` input, then invokes the unchanged Neutron packer, and finally fails unless the archive is **strictly less than 1,900,000 bytes** and its package inventory satisfies the Slim exclusions. Its deterministic test is:

```sh
npm --workspace neutron-plasmon run test:package:slim
```

The `<1,900,000` assertion belongs only to Slim; Base and Demo do not inherit that ceiling. Base and Demo package all five Monaco workers: `editor.worker.js`, `json.worker.js`, `css.worker.js`, `html.worker.js`, and `ts.worker.js`. Slim packages only `editor.worker.js` and disables dedicated language-service behavior.

Slim intentionally carries two representations of its one Monaco worker: `/System/Program Files/MonacoEditor/editor.worker.js` is the canonical packaged worker authority, while `runtime/monaco/worker-sources.js` contains the generated source preload needed to construct a worker inside Neutron's opaque-origin application sandbox. Slim does not carry a third `runtime/monaco/editor.worker.js` mirror. Base retains its URL-safe runtime mirrors because its packaged language-service acceptance exercises those dedicated workers as well as the opaque transport.

`.neutron` archives are built from generated `dist/`, not from the repository source tree. Slim's Plasmon-local pre-pack gate fails closed if repository/build-only artifacts such as Markdown documentation, source maps, TypeScript/JSX source, test/spec files, source directories, coverage output, or repository documentation leak into that boundary. Runtime-required non-code assets such as HTML, CSS, JSON, SVG/images, fonts, and WASM remain valid package members. The generic Neutron packer remains owned and unchanged outside `apps/plasmon`.

Heavyweight runtime delivery remains a separate runtime-configuration concern. Slim remains runtime-free; Base starts without heavyweight runtime payloads; Demo/custom preparations may opt into approved pinned runtimes without redefining either package tier.

See [`TESTING.md`](TESTING.md) for the canonical matrix.

The testing goal is layered confidence, not maximum browser coverage. Keep deterministic semantics in fast unit/integration tests. Use a real browser for behavior that actually depends on the DOM, focus/pointer events, workers, media/iframe behavior, packaged assets, or installed Neutron integration. Manual review remains necessary for visual quality and interaction feel that automation cannot establish.

A source-level implementation is not product acceptance when the user-visible path depends on packaging or browser behavior.

## Documentation

The repository is the durable authority for Plasmon documentation. External project/chat context should only bootstrap navigation; when it conflicts with current repository guidance, follow the repository source-of-truth order and surface material conflicts.

Start with:

- [`AGENTS.md`](AGENTS.md) — scoped implementation rules and source-of-truth order.
- [`docs/README.md`](docs/README.md) — documentation map and navigation authority.
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — shared terminology and identity distinctions.
- [`TESTING.md`](TESTING.md) — test protocol and CI lanes.
- [`src/README.md`](src/README.md) — active frontend layout and legacy boundaries.
- [`src/os/README.md`](src/os/README.md) — OS subsystem map.

Then read the nearest applicable subsystem `README.md` and `AGENTS.md` before modifying that scope.

Repository-level Neutron documentation under [`../../doc/`](../../doc/) remains authoritative for Kernel behavior.
