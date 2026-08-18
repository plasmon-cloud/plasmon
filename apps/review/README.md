# Review

`Review.neutron` is a standalone vanilla-Neutron application for durable human acceptance review.

One installed Review Element owns many logical Review Atoms. A Review Atom is an independently addressable review workspace with its own stable `AtomId`; it is not the physical AppScope, tile/window/process, source path, or historical revision.

## Product role

Review sits between an acceptance plan and engineering work:

1. An engineer or AI prepares a list of things that humans should verify in the real Plasmon OS.
2. Each acceptance check explains what should be tested and, when available, how to perform the real UI workflow and what successful behavior looks like.
3. Human reviewers perform those checks and independently record **Pass** or **Fail** plus observations/evidence.
4. Reviewers can leave and return later. Recorded results and observations remain durable.
5. Shared/provider updates do not interrupt the visible review. Review only pulls queued reviewer changes when the user chooses **Refresh**.
6. Ordinary local saves do not publish a new AI-facing result. **Submit** writes an explicit completed-review snapshot for downstream AI or engineering triage.
7. A downstream AI may consume that submitted human evidence to propose engineering Issues. The AI is not a human reviewer in the 0.1 workflow.

The core reviewer questions are deliberately narrow:

- What am I supposed to test?
- How should I test it in the real OS?
- What should happen?
- Did it pass?
- If it failed, what actually happened?
- What did other reviewers observe the last time I refreshed?

Project-management fields retained in the storage model for compatibility are not the primary Review UI. Review records human observations; downstream issue tracking owns engineering prioritization and implementation work.

## Human reviewer behavior

Each item has independent per-actor evidence. A reviewer result does not overwrite another reviewer's result.

New reviewer actions use the existing semantic transaction engine:

- **Pass** records `review.set_result = working`.
- **Fail** records `review.set_result = not_working` and requires an explanatory observation in the UI.
- Result notes are part of that participant result rather than being confused with general discussion.
- Existing comments/history remain available as shared context.

The provider persists each accepted Pass/Fail result and its observation immediately. Recorded review progress therefore survives closing and reopening Review. Text that has only been typed into the observation box but has not yet been recorded with Pass or Fail is a UI draft and is not promised durable across reopening.

## Refresh boundary

`review.state` notifications no longer auto-replace visible Review state. They mark that updates are waiting. The reviewer explicitly chooses **Refresh** to read the current provider state and other reviewer changes.

This is intentional preparation for shared Review Atoms: a remote update should not silently replace the context a human is currently reviewing.

## Submit boundary

Submit is distinct from persistence.

- Local reviewer results and observations are saved during normal review work.
- Submit writes the current revision to the configured submission Markdown path.
- During the current Review session, the UI indicates whether changes are newer than the last successful Submit.
- The submitted snapshot itself records the exact Review revision, so downstream consumers know which evidence they received.
- Submit does not grant an AI live access and does not imply MCP/tool integration.

The intended 0.1 bridge is explicit file/copy-and-paste interchange. Automated AI production/consumption belongs to later work.

## Import and export

AI-generated acceptance plans can be imported as Markdown/TODO. Top-level checklist entries become Review items, and indented content beneath each item is retained as human test instructions / expected behavior.

A submitted Review export contains:

- Review/Atom identity and revision,
- each acceptance check,
- test instructions / expected behavior,
- independent reviewer results,
- failure/observation notes,
- reviewer discussion.

It intentionally does not center Desired/Effort/Owner/Work metadata. The submitted format is evidence for downstream triage, not a replacement project-management database.

Import remains portability rather than identity: importing a file creates a new Review Atom and records the source path as provenance.

## Sharing

MTN-backed live sharing is not yet wired in the standalone build. The current application nevertheless establishes the intended shared-review interaction:

- recorded local progress is durable;
- independent participant results are already part of the Atom model;
- queued external changes require explicit Refresh;
- AI-facing publication requires explicit Submit.

Actual two-human MTN sharing and identity/revocation remain separate platform integration work.

## Architecture retained from the original Review MVP

- stable `ReviewItemId` records with independent per-actor evidence;
- typed semantic provider commands with optimistic `expectedRevision` and idempotent `commandId`;
- exactly one accepted semantic transaction creates one logical `RevisionId`;
- provider-owned normalized current state plus append-only semantic history;
- whole-Atom restore preserves Atom identity and prior history;
- Markdown/TODO portability through normal Neutron Files;
- one Review Element can own many logical Review Atoms;
- no Yjs/CRDT, Plasmon dependency, or MTN dependency in the standalone base application.

## Verification

```sh
npm --workspace neutron-review test
```

Semantic tests cover the Atom/revision invariants and acceptance-plan interchange. Packaged browser acceptance verifies the human workflow, durable recorded results across reopen, deliberate Submit behavior, history/restore, and import/export portability. The explicit Refresh interaction is implemented now; real cross-identity MTN sharing remains the integration needed to exercise remote reviewer delivery end to end.
