# Plasmon documentation map

This directory is the durable cross-subsystem documentation home for Plasmon. The repository is authoritative for Plasmon architecture, terminology, testing rules, and implementation guidance; chat, handoffs, and external project context are coordination and bootstrap aids only.

GitHub Issues are the canonical work and acceptance queue. Stable product knowledge belongs in scoped README/AGENTS files, canonical documents here, executable tests, contracts, or implementation.

## Start here

For Plasmon work, read in this order:

1. the current explicit task and its canonical GitHub Issue/PR, when applicable;
2. repository [`../../../AGENTS.md`](../../../AGENTS.md) for repository-wide production, migration, packaging, and release rules;
3. [`../README.md`](../README.md) for Plasmon product and architecture orientation;
4. [`../AGENTS.md`](../AGENTS.md) for Plasmon-wide contributor rules and source-of-truth order;
5. this documentation map;
6. the nearest applicable `README.md` and `AGENTS.md` for the subsystem being changed;
7. canonical documents linked by those files, then current implementation and tests as evidence.

For frontend work, [`../src/README.md`](../src/README.md) identifies the active source layout. For shared OS work, [`../src/os/README.md`](../src/os/README.md) maps the current OS subsystems. Do not infer active architecture from an old path, historical document, or external inventory when the current repository says otherwise.

## Documentation roles and inheritance

Use the nearest meaningful documentation boundary rather than adding documentation to every implementation directory.

- **`README.md`** explains what a repository/application/subsystem is, its public seams and broad implementation shape, important entry points, and where deeper authority lives.
- **`AGENTS.md`** contains durable agent-facing operational rules for its scope: authority boundaries, invariants, validation requirements, known traps, and escalation conditions.
- A nested `AGENTS.md` adds narrower rules; otherwise a directory inherits the nearest ancestor `AGENTS.md`.
- Canonical documents under this directory hold cross-subsystem architecture, accepted terminology, deeper rationale, compatibility constraints, and durable research that is too large or cross-cutting for a scoped README/AGENTS file.

The machine-readable boundary inventory is [`documentation-boundaries.json`](documentation-boundaries.json). It is the single source for which Plasmon directories are documentation boundaries, whether they require local README/AGENTS files or inherit AGENTS ownership, and which roots require direct-child classification. Do not duplicate that inventory in prose or external project context.

Concrete bugs, temporary migrations, current ownership, one-off acceptance fixes, and implementation sequencing belong in GitHub Issues and tests rather than README/AGENTS files.

## Terminology

Start with [`GLOSSARY.md`](GLOSSARY.md) for shared terms and identity distinctions including Neutron, Plasmon, Element, Isotope, AppScope, Atom, NodeId, `.neutron`, `.sys`, Program Files, AssociationRegistry, native process/window identity, and Sharing/provider identity.

The glossary defines vocabulary. Subsystem-specific behavior and invariants remain with the owning contracts, README/AGENTS files, tests, and implementation.

## Architecture and design

### Filesystem, Desktop, and application resources

- [`FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`](FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md) — filesystem/application resource model and shared desktop/file interaction architecture.
- [`FILESYSTEM_DESKTOP_UX_GAMES_CORRECTION.md`](FILESYSTEM_DESKTOP_UX_GAMES_CORRECTION.md) — accepted correction for game/runtime placement within that architecture.
- [`../src/os/fs/README.md`](../src/os/fs/README.md) and [`../src/os/file-manager/README.md`](../src/os/file-manager/README.md) — current implementation boundaries.

### Games and runtimes

- [`GAMES_DAEDALOS_ARCHITECTURE.md`](GAMES_DAEDALOS_ARCHITECTURE.md) — game/runtime architecture and daedalOS-derived product direction.
- [`../src/games/README.md`](../src/games/README.md) — current games implementation boundary.
- [`../src/native-apps/README.md`](../src/native-apps/README.md) — first-party native application/runtime host boundary.

### Visual system

- [`VISUAL_SYSTEM_THEME.md`](VISUAL_SYSTEM_THEME.md) — shared visual-system architecture and design direction.
- [`../src/os/visual/README.md`](../src/os/visual/README.md) — current implementation boundary.

### Atoms and collaboration

Start with [`atoms/README.md`](atoms/README.md), which indexes the Atom design documents and explains their relationship to current contracts and implementation.

For current Sharing implementation and its fail-closed MTN boundary, read [`../src/os/sharing/README.md`](../src/os/sharing/README.md).

## Testing and acceptance

[`../TESTING.md`](../TESTING.md) is the canonical Plasmon testing protocol. [`../test/README.md`](../test/README.md) describes the Plasmon test boundary and current suites.

Use the lowest layer that can honestly prove the behavior through production code. Deterministic semantics should normally be exercised with Bun/model/headless/RTL coverage; browser tests are for genuine browser boundaries; package/installed evidence is required when build output or Neutron packaging is part of the claim; manual review remains necessary where visual quality or interaction feel cannot be established automatically.

Historical refactor test packets or old staging procedures are provenance, not current testing authority, unless the current testing documentation explicitly adopts them.

## Parity and acceptance records

- [`DAEDALOS_PARITY_LEDGER.md`](DAEDALOS_PARITY_LEDGER.md) — evidence ledger for daedalOS feature-completeness reference behavior and Plasmon implementation, headless, packaged/browser, and human/manual acceptance state.
- [`ACCEPTANCE_2026-08-11_BASELINE_GATE.md`](ACCEPTANCE_2026-08-11_BASELINE_GATE.md) — dated integrated disposition of the 2026-08-11 packaged/manual review findings.

The parity ledger is an evidence index, not a second backlog. Advance an evidence column only when that exact layer is proven. Source presence, deterministic tests, packaged/browser execution, and human review are separate claims. Unknown evidence stays unverified rather than being inferred from another layer.

## Neutron / Kernel boundary

Plasmon does not redefine the Kernel. Repository-level Neutron documentation under [`../../../doc/`](../../../doc/) remains authoritative for Kernel capabilities, isolation, installation/package/runtime behavior, persistent-memory rules, security boundaries, and other Neutron-owned contracts.

Read the applicable `/doc/` material when Plasmon work crosses that boundary. If Plasmon appears to require a Kernel capability that current contracts do not provide, identify and escalate the missing capability rather than silently inventing a Kernel API or shadow authority inside Plasmon.

## Source-of-truth order

When guidance materially conflicts:

1. current explicit task;
2. nearest applicable `AGENTS.md`;
3. accepted canonical architecture/contracts and authoritative repository documentation;
4. scoped `README.md`;
5. current implementation and tests as evidence of current behavior.

Surface material conflicts rather than silently choosing the easiest interpretation. Old chat, external project sources, old handoffs, and historical documents do not outrank decisions that have since been committed into repository authority.

## Durable knowledge rule

When implementation or research establishes something future developers or agents need to know, update the appropriate repository authority as part of the work. Examples include architectural invariants, reference behavior, runtime constraints, subsystem boundaries, persistence behavior, important acceptance requirements, and non-obvious traps.

Prefer:

```text
code + tests + durable repository documentation
```

over important knowledge that exists only in chat, an external project source, or an agent handoff.
