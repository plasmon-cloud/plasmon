# Review

`Review.neutron` is the first standalone implementation of a Plasmon Atom concept, but it is a normal **vanilla Neutron application** and has no Plasmon or MTN runtime dependency.

One installed Review Element owns many logical Review Atoms. An Atom is identified by `AtomId`; it is not the physical AppScope, tile/window/process, source path, or historical revision.

## MVP behavior

- Create and reopen multiple logical Review Atoms in one installation.
- Import Markdown/TODO through normal Neutron Files. The source path/hash is provenance, not Atom identity.
- Stable `ReviewItemId` records with independent per-actor evidence.
- Review-specific Desired, Effort, Owner, Work state, blockers/dependencies, and item comments.
- Typed semantic provider commands with optimistic `expectedRevision` and idempotent `commandId`.
- Exactly one accepted semantic transaction creates one logical `RevisionId`.
- Whole-Atom restore creates a **new** current logical revision and preserves old history.
- Export readable Markdown/TODO through normal Neutron Files.

## Persistence

The persistent background owns canonical Review data using Neutron's `persistent_browser_storage` capability. Current state is normalized into Atom metadata, item records, and comment records. Every accepted semantic mutation appends one revision/event journal record. Initial creation, every twentieth revision, and restore create checkpoints used for historical reconstruction.

Ordinary small-field edits write only changed records plus revision/receipt metadata; `RevisionId` does not imply a snapshot, Git commit/tree, content-addressed object, chunk manifest, or immutable publication.

## Package shape

- `src/index.tsx` — human Review tile.
- `src/service.ts` — persistent background and Review-specific agent tools.
- `src/engine.ts` — deterministic semantic transaction engine.
- `src/persistence.ts` — normalized IndexedDB production persistence and in-memory test port.
- `src/markdown.ts` — bounded Markdown/TODO import/export.
- `src/neutron_files_port.ts` — normal Neutron Files attachment boundary.

## Verification

```sh
npm --workspace neutron-review test
```

The package/browser lane additionally provisions vanilla Neutron and checks installed package bytes plus a Playwright create/edit/reopen workflow. It intentionally does not require Plasmon or MTN.
