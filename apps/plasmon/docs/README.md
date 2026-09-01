# Plasmon documentation map

This directory is the durable cross-subsystem documentation home for Plasmon. The repository is authoritative for current Plasmon architecture, terminology, testing rules, live compatibility contracts, and implementation guidance. GitHub Issues own current work/acceptance; Git history and GitHub own superseded release/refactor provenance.

Stable product knowledge belongs in scoped README/AGENTS files, current canonical documents here, executable tests, contracts, or implementation. Historical-only release packets, dated acceptance ledgers, experiments, reconciliation records, and superseded design handoffs are intentionally not retained as current repository documentation.

## Start here

For Plasmon work, read in this order:

1. the current explicit task and its canonical GitHub Issue/PR, when applicable;
2. repository [`../../../AGENTS.md`](../../../AGENTS.md) for repository-wide production, migration, packaging, and release rules;
3. [`../README.md`](../README.md) for Plasmon product and architecture orientation;
4. [`../AGENTS.md`](../AGENTS.md) for Plasmon-wide contributor rules and source-of-truth order;
5. this documentation map;
6. the nearest applicable `README.md` and `AGENTS.md` for the subsystem being changed;
7. current canonical documents linked by those files, then current implementation and tests as evidence.

For frontend work, [`../src/README.md`](../src/README.md) identifies the active source layout. For shared OS work, [`../src/os/README.md`](../src/os/README.md) maps the current OS subsystems. Do not infer active architecture from an old branch, Issue packet, dated acceptance record, experiment note, or superseded design handoff when current repository authority exists.

## Documentation authority classes

Every checked-in Plasmon documentation artifact should fit one of these roles:

- **Current normative architecture / behavior** — accepted identity, ownership, lifecycle, persistence, security-boundary, or cross-subsystem rules that describe how Plasmon works now.
- **Current operational / contributor guidance** — repository and Plasmon `AGENTS.md`, `TESTING.md`, documentation maps, test-boundary guidance, build/package instructions, and similar instructions needed to work on the current tree.
- **Live compatibility / migration reference** — older formats, schemas, package/runtime compatibility constraints, or migration rules that current code still has to understand. Keep these current only while the compatibility obligation is live, and state what current implementation depends on them.

Superseded release/refactor/acceptance provenance belongs in Git history or the owning GitHub conversation, not in a checked-in history archive. If historical evidence reveals a still-current invariant, restate that invariant in its current owning README/AGENTS/contract before relying on it.

## Documentation roles and inheritance

Use the nearest meaningful documentation boundary rather than adding documentation to every implementation directory.

- **`README.md`** explains what a repository/application/subsystem is, its public seams and broad implementation shape, important entry points, and where deeper authority lives.
- **`AGENTS.md`** contains durable agent-facing operational rules for its scope: authority boundaries, invariants, validation requirements, known traps, and escalation conditions.
- A nested `AGENTS.md` adds narrower rules; otherwise a directory inherits the nearest ancestor `AGENTS.md`.
- Canonical documents under this directory hold cross-subsystem architecture, accepted terminology, deeper rationale, compatibility constraints, and durable research that is too large or cross-cutting for a scoped README/AGENTS file.

The machine-readable boundary inventory is [`documentation-boundaries.json`](documentation-boundaries.json). It is the single source for which Plasmon directories are documentation boundaries, whether they require local README/AGENTS files or inherit AGENTS ownership, and which roots require direct-child classification.

Documentation automation is limited to machine-provable contracts: declared boundaries must exist, required README/AGENTS ownership must resolve, discovery roots must classify their first-class children, and the generated index below must match the registry. Semantic documentation freshness is not represented by a whole-tree digest or acknowledgement marker. When implementation changes a durable invariant, authority boundary, public seam, or other lasting guidance, update the owning documentation in that work; ordinary implementation changes do not require no-op documentation edits.

<!-- plasmon-documentation-boundaries:start -->
<!-- Generated from documentation-boundaries.json by documentation-boundaries.mjs. Do not edit this table by hand. -->
| Boundary | Kind | README | AGENTS |
| --- | --- | --- | --- |
| `apps/plasmon` | application-root | local | local |
| `apps/plasmon/backend` | backend | local | local |
| `apps/plasmon/docs` | documentation-index | local | inherited from `apps/plasmon/AGENTS.md` |
| `apps/plasmon/docs/atoms` | documentation-index | local | inherited from `apps/plasmon/AGENTS.md` |
| `apps/plasmon/src` | source-root | local | local |
| `apps/plasmon/src/demo` | demo-fixtures | local | inherited from `apps/plasmon/src/AGENTS.md` |
| `apps/plasmon/src/games` | subsystem | local | local |
| `apps/plasmon/src/native-apps` | native-app-root | local | local |
| `apps/plasmon/src/native-apps/browser` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/emulatorjs` | runtime-host | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/explorer` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/jsdos` | runtime-host | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/markdown` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/monaco-runtime-config` | runtime-config | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/photos` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/properties` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/recycle-bin` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/settings` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/shared/monaco` | browser-adapter | local | local |
| `apps/plasmon/src/native-apps/text` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/native-apps/video` | native-app | local | inherited from `apps/plasmon/src/native-apps/AGENTS.md` |
| `apps/plasmon/src/os` | os-root | local | local |
| `apps/plasmon/src/os/associations` | os-subsystem | local | local |
| `apps/plasmon/src/os/contracts` | os-subsystem | local | local |
| `apps/plasmon/src/os/desktop` | os-subsystem | local | local |
| `apps/plasmon/src/os/diagnostics` | os-subsystem | local | inherited from `apps/plasmon/src/os/AGENTS.md` |
| `apps/plasmon/src/os/file-manager` | os-subsystem | local | local |
| `apps/plasmon/src/os/fs` | os-subsystem | local | local |
| `apps/plasmon/src/os/integration` | os-subsystem | local | local |
| `apps/plasmon/src/os/neutron` | os-subsystem | local | local |
| `apps/plasmon/src/os/process` | os-subsystem | local | local |
| `apps/plasmon/src/os/sharing` | os-subsystem | local | inherited from `apps/plasmon/src/os/AGENTS.md` |
| `apps/plasmon/src/os/shell` | os-subsystem | local | local |
| `apps/plasmon/src/os/visual` | os-subsystem | local | local |
| `apps/plasmon/src/os/windowing` | os-subsystem | local | local |
| `apps/plasmon/test` | testing | local | local |
<!-- plasmon-documentation-boundaries:end -->

Concrete bugs, temporary migrations, current ownership, one-off acceptance fixes, and implementation sequencing belong in GitHub Issues and tests rather than README/AGENTS files.

## Terminology

Start with [`GLOSSARY.md`](GLOSSARY.md) for shared terms and identity distinctions including Neutron, Plasmon, Element, Isotope, AppScope, Atom, NodeId, `.neutron`, `.sys`, Program Files, AssociationRegistry, native process/window identity, and Sharing/provider identity.

The glossary defines vocabulary. Subsystem-specific behavior and invariants remain with the owning contracts, README/AGENTS files, tests, and implementation.

## Current architecture and design

### Filesystem, Desktop, and application resources

- [`FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`](FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md) — accepted filesystem/application-resource model and shared desktop/file interaction architecture.
- [`../src/os/fs/README.md`](../src/os/fs/README.md), [`../src/os/file-manager/README.md`](../src/os/file-manager/README.md), and [`../src/os/desktop/README.md`](../src/os/desktop/README.md) — current implementation boundaries and local rules.

### Games and runtimes

- [`../src/games/README.md`](../src/games/README.md) — current game-domain boundary, ordinary-resource/association model, persistence direction, and demo-content separation.
- [`../src/native-apps/README.md`](../src/native-apps/README.md) — native application and runtime-host boundary.
- [`../src/native-apps/jsdos/README.md`](../src/native-apps/jsdos/README.md) and [`../src/native-apps/emulatorjs/README.md`](../src/native-apps/emulatorjs/README.md) — current runtime-specific authority.

### Visual system

- [`../src/os/visual/README.md`](../src/os/visual/README.md) — current visual-system authority, presentation boundaries, shared primitives, refactor direction, and testing guidance.

### Atoms and collaboration

Start with [`atoms/README.md`](atoms/README.md) for the current Atom identity, revision, live-state/publication, and authorization model plus pointers to live contracts. For current Sharing implementation and its fail-closed MTN boundary, read [`../src/os/sharing/README.md`](../src/os/sharing/README.md).

## Testing and acceptance

[`../TESTING.md`](../TESTING.md) is the canonical Plasmon testing protocol. [`../test/README.md`](../test/README.md) describes the Plasmon test boundary and current suites.

Use the lowest layer that can honestly prove the behavior through production code. Deterministic semantics should normally be exercised with Bun/model/headless/RTL coverage; browser tests are for genuine browser boundaries; package/installed evidence is required when build output or Neutron packaging is part of the claim; manual review remains necessary where visual quality or interaction feel cannot be established automatically.

Implementation, headless verification, packaged/browser verification, and human/manual acceptance are separate evidence claims. Do not promote one layer because another passed. Current acceptance ownership and closure live in GitHub Issues and current executable inventories.

## Neutron / Kernel boundary

Plasmon does not redefine the Kernel. Repository-level Neutron documentation under [`../../../doc/`](../../../doc/) remains authoritative for Kernel capabilities, isolation, installation/package/runtime behavior, persistent-memory rules, security boundaries, and other Neutron-owned contracts.

Read the applicable `/doc/` material when Plasmon work crosses that boundary. If Plasmon appears to require a Kernel capability that current contracts do not provide, identify and escalate the missing capability rather than silently inventing a Kernel API or shadow authority inside Plasmon.

## Source-of-truth order

When guidance materially conflicts:

1. current explicit task;
2. nearest applicable `AGENTS.md`;
3. accepted current architecture/contracts and authoritative repository documentation;
4. scoped `README.md`;
5. current implementation and tests as evidence of current behavior.

Old chat, external project sources, release/refactor packets, old handoffs, and superseded documents do not become current merely because they can be recovered from repository history.

## Durable knowledge rule

When implementation or research establishes something future developers or agents need to know, update the appropriate current repository authority as part of the work. Examples include architectural invariants, reference behavior, runtime constraints, subsystem boundaries, persistence behavior, important acceptance requirements, and non-obvious traps.

Prefer:

```text
code + tests + durable current repository documentation
```

over important knowledge that exists only in chat, an external project source, an agent handoff, or historical provenance.
