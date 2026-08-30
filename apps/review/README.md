# Review

`Review.neutron` is a standalone vanilla-Neutron application for durable human acceptance review.

One installed Review Element owns many logical Review Atoms. A Review Atom is an independently addressable review workspace with its own stable `AtomId`; it is not the physical AppScope, tile/window/process, source path, or historical revision.

## Product role

Review sits between an acceptance plan and engineering work:

1. An AI or engineer prepares a list of things humans should verify in the real Plasmon OS.
2. The plan describes each acceptance check and, when available, the real UI workflow and expected behavior.
3. Human reviewers perform those checks and independently record **Pass** or **Fail** plus observations/evidence.
4. Recorded results remain durable so a reviewer can leave and resume later.
5. Shared/provider updates never silently replace the visible Review. The human chooses **Refresh** before queued reviewer changes are pulled in.
6. Ordinary local saves do not publish a downstream result. **Submit** marks one exact Review revision as the deliberate AI/engineering snapshot.
7. The submitted Markdown can be copied into the downstream AI/engineering conversation, which may then propose Issues from the human evidence.

The AI is an author/consumer of the Review plan and results; it is not treated as the human who performed acceptance checks.

## First-run workflow

The guaranteed standalone workflow does not require the separate Files application:

```text
AI / engineer
    -> Markdown/TODO acceptance plan
    -> Paste AI test plan
    -> Review Atom
    -> human Pass/Fail + observations
    -> Submit current review
    -> Copy for AI
    -> downstream triage / Issues
```

The primary reviewer questions are deliberately narrow:

- What am I supposed to test?
- How should I test it in the real OS?
- What should happen?
- Did it pass?
- If it failed, what actually happened?
- What did other reviewers observe the last time I refreshed?

Legacy coordination fields remain in the stored Review model for compatibility, but `Desired`, `Effort`, `Owner`, and `Work` are not the primary reviewer interaction. Review records human observations; downstream issue tracking owns engineering prioritization and implementation work.

## Import

**Paste AI test plan** is the primary import path. It calls the Review provider directly with bounded Markdown/TODO text and therefore works when Review is the only installed application besides the Kernel.

Top-level Markdown bullets or checkboxes become acceptance checks. Indented lines beneath each check are retained as test instructions / expected behavior. A top-level `#` heading becomes the Review title unless the human provides a title explicitly.

Example:

```markdown
# Human Acceptance Review

- [ ] Explorer Back returns to the prior folder
  1. Open Explorer.
  2. Navigate into two folders.
  3. Press Back.
  Expected: Explorer returns to the folder you just left.
```

Files-backed Markdown/TODO import remains available as an **optional portability path**. If Files is not installed, Review reports that Files is unavailable and directs the user to paste the plan instead; it must not expose a raw `app:files:background` endpoint failure as the core workflow.

Import remains portability rather than identity. File-backed import records source provenance; pasted text does not invent a fake source path.

## Human reviewer behavior

Each item stores independent per-actor evidence. One reviewer result does not overwrite another reviewer's result.

- **Pass** records `review.set_result = working`.
- **Fail** records `review.set_result = not_working` and requires an explanatory observation in the UI.
- Result notes belong to that participant result rather than being confused with generic project-management metadata.
- Existing comments/history remain shared context.

The provider persists each accepted Pass/Fail result and observation immediately. Recorded progress survives closing and reopening Review. Text typed into an observation box but not yet recorded with Pass or Fail is only a UI draft and is not promised durable across reopening.

## Refresh boundary

`review.state` notifications do not auto-replace visible Review state. They mark that updates are waiting. The reviewer explicitly chooses **Refresh** to read the current provider state and other reviewer changes.

This prepares the UI for later MTN-backed sharing without allowing a remote update to silently replace the context a human is currently reviewing.

## Submit and export

Submit is distinct from persistence.

- Local reviewer results and observations are saved during ordinary review work.
- **Submit current review** records the exact current logical revision as the latest deliberate submission and returns its readable Markdown snapshot.
- **Copy for AI** uses Neutron's trusted clipboard bridge from a human click; it does not require Files and it does not imply live AI access.
- After reopening Review, the provider-local submission marker identifies the exact submitted revision and Review can render that historical snapshot again.
- Any later Review mutation makes the UI show that current changes are not submitted until the human chooses Submit again.

A submitted snapshot contains:

- Review/Atom identity and exact revision;
- every acceptance check;
- test instructions / expected behavior;
- independent reviewer results;
- failure/observation notes;
- reviewer discussion.

Saving the submitted Markdown through the separate Files app remains an optional portability action. The basic AI handoff never depends on Files.

## Sharing

MTN-backed live sharing is not wired in this standalone release. The application nevertheless establishes the intended shared-review interaction:

- recorded local progress is durable;
- independent participant results are part of the Atom model;
- queued external changes require explicit Refresh;
- downstream publication requires explicit Submit.

Actual two-human MTN sharing, authoritative remote identity, rights, and revocation remain separate platform integration work.

## Architecture retained from the original Review MVP

- stable `ReviewItemId` records with independent per-actor evidence;
- typed semantic provider commands with optimistic `expectedRevision` and idempotent `commandId`;
- exactly one accepted semantic transaction creates one logical `RevisionId`;
- provider-owned normalized current state plus append-only semantic history;
- whole-Atom restore preserves Atom identity and prior history;
- Markdown/TODO portability is not canonical Atom identity/state;
- one Review Element can own many logical Review Atoms;
- no Yjs/CRDT, Plasmon dependency, or MTN dependency in the standalone application.

Submission bookkeeping is provider-local operational metadata and does not create a Review logical revision. The existing submission IndexedDB remains at its original schema/version; older records containing Files `path`/`etag` fields remain valid because those fields are optional compatibility metadata rather than a new persistent schema.

## Package and verification

This change is Review package version `101` (`review.v0.1.1.neutron`). The previous package bytes remain historical; changed bytes are not republished under the old version.

Run:

```sh
npm --workspace neutron-review test
```

Semantic tests cover Atom/revision invariants, plan parsing, and submission bookkeeping. The Review CI packaged-browser lane intentionally provisions vanilla Neutron **without Files** and proves the standalone paste-plan -> review -> reopen -> Submit -> Copy workflow against the installed package bytes. Optional Files portability is a separate integration path and is not allowed to make the standalone gate green.
