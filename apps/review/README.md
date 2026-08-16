# Review

`Review.neutron` is a standalone **vanilla Neutron application** for structured review work. It has no Plasmon or MTN runtime dependency.

One installed Review Element owns many logical Review Atoms. A Review Atom is a durable workspace with its own stable `AtomId`; it is not the physical AppScope, tile/window/process, source path, or historical revision.

## Using Review

A Review is organized around review items. Each item keeps the primary workflow visible together:

- **Desired** — how strongly the outcome needs to be true (`Must`, `High`, `Normal`, or `Later`).
- **Effort** — the expected size of the work, from `Tiny` through `Really big`.
- **Owner** — the person or team responsible for moving the item forward; an empty owner is explicitly unassigned.
- **Work** — the current workflow state such as `Ready`, `In progress`, `Blocked`, `Needs retest`, or `Done`.
- **Evidence** — the local reviewer result plus evidence/comments attached to the item.
- **Activity / History** — the semantic actions that changed the Review, including actor/time information when available.

Create a Review from the left workspace panel, add the first item in the main workspace, fill the structured fields, and choose **Save details**. Evidence results and evidence notes are completed actions and persist immediately after the provider accepts them.

### Persistence

Review has no fake app-wide Save button. The persistent background owns canonical Review data using Neutron's `persistent_browser_storage` capability.

The UI reports persistence truthfully:

- completed actions show **Saved** after the provider accepts them;
- edits to Desired / Effort / Owner / Work show **Unsaved changes** until **Save details** is chosen;
- failed actions show an explicit error and are not presented as saved;
- pending item/evidence input and restore confirmation are kept after a failed provider action so the user can retry; success cleanup runs only after provider acceptance.

Current state is normalized into Atom metadata, item records, and comment records. Every accepted semantic mutation appends one revision/event journal record. Initial creation, every twentieth revision, and restore create checkpoints used for historical reconstruction.

### History and restore

Each accepted semantic transaction creates one logical `RevisionId`. History shows those revisions as user-readable activity rather than exposing storage encoding.

Restore is deliberately a two-step action. Restoring a prior logical revision changes the current state by creating a **new** logical revision, keeps the same `AtomId`, and preserves the existing history. If the provider rejects the restore, Review keeps the confirmation visible instead of implying the restore completed.

### Sharing

Live MTN-backed sharing is **not available in the current standalone build**. Review does not display an active-looking Share action or imply that a live link exists.

Markdown/TODO import/export is portability, not collaboration:

- import creates a new logical Review Atom and records the source as provenance;
- export writes a readable Markdown copy through normal Neutron Files;
- neither operation changes Atom identity into a filesystem path or creates a live shared Review.

Live sharing remains separate work governed by #125/#127.

## MVP architecture

- Stable `ReviewItemId` records with independent per-actor evidence.
- Typed semantic provider commands with optimistic `expectedRevision` and idempotent `commandId`.
- Exactly one accepted semantic transaction creates one logical `RevisionId`.
- Provider-owned current state plus append-only semantic history.
- Whole-Atom restore preserves Atom identity and prior history.
- Markdown/TODO portability through normal Neutron Files.
- No Yjs/CRDT, Plasmon dependency, or MTN dependency in the base application.

Ordinary small-field edits write only changed records plus revision/receipt metadata; `RevisionId` does not imply a snapshot, Git commit/tree, content-addressed object, chunk manifest, or immutable publication.

## Package shape

- `src/index.tsx` — human Review tile and first-demo workflow.
- `src/action_outcome.ts` — deterministic action outcome and retry-safe draft cleanup rules.
- `src/presentation.ts` — deterministic user-facing vocabulary and draft/presentation helpers.
- `src/style.scss` — light/dark Review presentation tokens and responsive desktop layout.
- `src/service.ts` — persistent background and Review-specific agent tools.
- `src/engine.ts` — deterministic semantic transaction engine.
- `src/persistence.ts` — normalized IndexedDB production persistence and in-memory test port.
- `src/markdown.ts` — bounded Markdown/TODO import/export.
- `src/neutron_files_port.ts` — normal Neutron Files attachment boundary.

## Verification

```sh
npm --workspace neutron-review test
```

The semantic suite includes the failure-path contract: rejected provider actions surface an explicit failed outcome, preserve submitted drafts, and never clear newer input accidentally.

The Review CI package/browser lane additionally provisions vanilla Neutron and checks installed package bytes plus Playwright acceptance for:

- first-run copy and sharing/persistence truth;
- light/dark readability;
- normal and narrow-window layout without horizontal overflow;
- create/edit/evidence workflow;
- explicit unsaved-to-saved item-detail behavior;
- history and deliberate restore;
- persistence across reopen;
- Markdown export/import portability.

Browser evidence is captured in the Playwright report. It intentionally does not require Plasmon or MTN.
