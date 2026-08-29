# First Collaborative Plasmon Atom — Hackathon MVP Scope

Status: **SCOPE CONTRACTION FOLLOW-UP — DESIGN ONLY — VANILLA NEUTRON MUST GATE**

Parent architecture: `FIRST_COLLABORATIVE_ATOM_DESIGN.md` at `d842fd93d6ea080e8170caae26c5ccc78d65647a` remains approved and authoritative for the broader architecture/research direction.

This document does **not** replace or substantially revise that design. It narrows the first implementation target and corrects the acceptance environment after Coordinator A/C review.

> **The hackathon MUST gate is a completely normal Review `.neutron` application running productively on stock/vanilla Neutron. Plasmon + MTN live sharing is a HIGH-value stretch demonstration, not a prerequisite for the base app.**

The product question is therefore:

> What is the smallest normal Neutron Review application that proves one Element can own multiple logical Atoms, keeps those Atoms richer than their source files, and is immediately useful for Plasmon GUI review without becoming Jira, Scrum software, Google Docs, or a custom-kernel-only demo?

---

## 1. Scope decision

The hackathon Review Element does **not** need a general collaborative Markdown editor.

It does **not** need Yjs or another CRDT for version 1.

It does **not** need text-range comments, live cursor presence, per-user text undo, arbitrary concurrent source editing, dependency-aware selective history surgery, sophisticated checkpoint retention, or a generalized collaboration framework.

It also does **not** require Plasmon, MTN, a shared URL, cross-AppScope leases, authenticated multi-user live sharing, or custom-kernel behavior for the MUST acceptance gate.

The recommended first implementation is:

```text
normal Review.neutron app on vanilla Neutron
        +
normal File > Open through Neutron Files
        +
provider-owned structured Review state
        +
multiple logical AtomIds inside one Review installation
        +
typed commands
        +
append-only meaningful activity/events
        +
durable whole-Atom revisions
        +
owner restore to a prior revision
        +
Markdown/TODO import and export
```

That is sufficient to prove the base architectural chain:

```text
Element
  -> one normal physical Review installation
  -> multiple logical Review Atoms
  -> source file is not the Atom
  -> structured Review state is richer than Markdown
  -> human + agent clients operate through typed Review commands
  -> meaningful history and recovery work
```

The custom Plasmon/MTN stretch path then proves the second chain:

```text
same Review.neutron
  -> shared Review Atom URL
  -> Plasmon bootstrap/install/open UX
  -> MTN 0.2 live authorization
  -> authenticated humans + AI operate on one live Atom
```

The first chain is **MUST**. The second is **HIGH / hackathon stretch**.

---

## 2. Vanilla Neutron is the primary acceptance environment

Primary acceptance path:

```text
install/open Review.neutron
  -> File > Open
  -> select/open Markdown/TODO source through normal Neutron Files access
  -> Review imports or reopens a logical Review Atom
  -> user reviews/tests/comments/coordinates
  -> Review persists richer Atom state independently of source Markdown
  -> user can export readable Markdown/TODO
```

No Plasmon Desktop or MTN component is necessary to complete this path.

The Review package should behave like an ordinary Neutron app first. Plasmon should later make that same application easier to discover, install, open, and share; Plasmon must not be what makes Review functional in the first place.

### 2.1 Spreadsheet precedent

The existing `apps/spreadsheet` application establishes the vanilla conventions that matter here:

- it is a normal `.neutron` application with a persistent background resident;
- its tile offers ordinary **New/Open** behavior;
- **File > Open** operates on a Files path rather than a special shell-only object loader;
- the resident reads bytes through the normal Neutron Files app-tool boundary;
- the first file operation goes through normal Neutron consent rather than bypassing that security boundary;
- non-native sources such as CSV/XLSX are imported into richer application state rather than treated as lossless writable native state;
- source provenance is tracked separately from the current application model;
- mutations use a workbook identity/revision plus command IDs to reject stale writes;
- the manifest uses a persistent background and `persistent_browser_storage` on vanilla Neutron.

Relevant implementation references:

```text
apps/spreadsheet/README.md
apps/spreadsheet/neutron.json
apps/spreadsheet/src/index.tsx
apps/spreadsheet/src/session.ts
apps/spreadsheet/src/file_ports.ts
apps/spreadsheet/src/neutron_files_port.ts
apps/spreadsheet/src/recovery.ts
```

Review should borrow these conventions where they fit. It should **not** clone Spreadsheet's workbook-specific native-file model merely because Spreadsheet has `.nsheet`.

Spreadsheet needs `.nsheet` because its full workbook must have a lossless writable file representation. Review's MVP has a different goal: its canonical Atom state can be owned by the Review application's persistent provider/background store, while Markdown/TODO remains a readable source/projection.

### 2.2 File > Open semantics for Review

Review's File > Open is source-oriented:

```text
File > Open
  -> ordinary Neutron Files read
  -> Markdown/TODO bytes
  -> parse into stable ReviewItemIds
  -> create a new logical Review Atom
```

The import records source provenance such as:

```text
path
media type
source etag/hash if available
import timestamp
```

The source path/hash helps humans understand where the Review came from; it is **not** Atom identity.

If the selected source path is already linked to exactly one known Review Atom in the current installation, Review may offer/reopen that existing Atom rather than silently duplicate it. If there are multiple matching historical imports, or the source changed externally, the app should ask the user whether to open an existing Review or import a new Review. It should not silently merge external Markdown changes into canonical Atom state for V1.

A separate small **Recent Reviews / Open Review** view may reopen Atom records already owned by Review without requiring the original Markdown file to exist.

### 2.3 Source file is not the Atom

After import:

```text
/todo.md
   !=
Review Atom 01J...
```

The Atom remains usable if `/todo.md` is later renamed, changed, or deleted.

The source file contains portable review/template text. The Atom additionally contains:

- stable item IDs;
- human evidence;
- Desired/Effort/Owner/Work state;
- dependency/blocker references;
- comments;
- activity;
- durable revisions;
- restore history.

This is one of the primary MUST proofs.

### 2.4 Simplest vanilla persistence model

The simplest sensible V1 model is:

```text
Review persistent background/provider storage
  -> Atom catalog keyed by AtomId
  -> normalized/current structured state for each Atom
  -> append-only semantic transaction/event journal
  -> sparse/occasional checkpoints as an implementation optimization
  -> source provenance
```

Use the normal Neutron persistent-background/browser-storage capability already demonstrated by Spreadsheet rather than requiring Plasmon-owned storage or a custom kernel path.

For the hackathon, "durable" means the Review Atom and its revisions survive ordinary tile close/reopen and app-session lifecycle expected from the declared persistent storage capability. Cross-device replication is not a MUST requirement.

A future implementation may move or mirror this state into stronger app-backend storage without changing logical Atom identity or RevisionId semantics.

A tiny hackathon implementation may choose to persist full state snapshots for convenience. That is a physical implementation choice only; it is not the semantic definition of a Review revision and must not harden into the generic Atom contract.

### 2.5 No special `.atom` file format for MUST

Do **not** require a `.atom`, `.review`, or `.nreview` native file solely to make the architecture feel object-oriented.

The MVP already has a natural split:

```text
canonical rich state -> Review-owned persistent Atom store
portable source/report -> Markdown/TODO in Files
```

A lossless portable Atom archive may become HIGH/ADVANCED if users need backup, migration, handoff between vanilla installations, or offline transport of full comments/history. That is a concrete future reason for a native/archive format; the MUST gate does not yet provide one.

---

## 3. What one MVP Atom is

One Atom remains the logical object defined by the approved architecture:

> **One Review Atom is one independently addressable review workspace owned by the Review Element.**

For vanilla V1, "independently addressable" does not require MTN sharing. It means the Review app can create, list, open, revise, restore, and export Atom A separately from Atom B even though both live inside the same physical Review installation.

Example:

```text
Review Element installation
  ├─ Atom A: Plasmon GUI review
  ├─ Atom B: Sharing review
  └─ Atom C: Later regression review
```

Each Atom contains only what is needed for GUI review coordination:

- stable review items imported from a Markdown/TODO template or created later;
- title and optional descriptive Markdown/text per item;
- independent participant/test evidence;
- lightweight coordinator/work metadata;
- item comments/replies;
- meaningful recent activity;
- durable revisions sufficient for whole-Atom restore;
- source/import/export metadata.

It does **not** make the complete Markdown source a simultaneously editable Google-Docs-like surface.

---

## 4. Product goal: a dog-food review board, not project management

A typical Review item may look like:

```text
#72  Text editor opens Monaco

Brian:       NOT WORKING
Alice:       WORKING
Carol:       NEEDS POLISH

Desired:     MUST
Effort:      Small
Owner:       Agent 2
Work state:  NEEDS RETEST
Blocked by:  #61

Comments:
- Alice: Opens, but keyboard focus is wrong.
- AI Agent: Likely related to OpenWithServiceModel integration.
```

The central invariant is:

```text
human test evidence
    !=
coordinator/work metadata
```

Brian saying `NOT WORKING` must remain intact when a coordinator sets the item to `NEEDS RETEST`, `IN PROGRESS`, or `DONE`.

The tool should make it easy to answer:

```text
What is broken?
What has not been tested?
What needs polish?
What MUST items are still unresolved?
What is ready for Agent 2?
What needs retesting?
What changed recently?
```

The Review Element should explicitly **not** add:

- story points;
- sprint ceremonies;
- velocity/burndown charts;
- epics;
- complex workflow configuration;
- automatic prioritization;
- Scrum roles/process;
- generalized issue-tracker machinery.

A "sprint" can simply be a saved or temporary query/view over existing Review fields. It is not a new state machine or generic Atom concept.

---

## 5. Pressure-test: is Yjs/CRDT required?

### Decision: no, not for version 1

Yjs remains a strong future option if Review later becomes a genuinely collaborative document editor, as documented in the approved architecture.

The V1 operations are naturally structured writes:

```text
Brian sets his result on item #72
AI adds a comment
Brian changes Desired to MUST
Agent 2 becomes Owner
Work state becomes NEEDS RETEST
```

In the future live multi-user stretch:

```text
Alice sets her result on item #72
Bob sets his result on item #72
Carol comments on item #72
AI sets work state to NEEDS RETEST
```

These do not require a text CRDT because the schema already gives independent records stable identities.

For example:

```text
review result key = (itemId, participant/actor key)
comment key       = commentId
coordinator data  = itemId + coordinator fields
```

A conflict only exists when two callers update the **same coordinator field** or the **same mutable item description**. Ordinary optimistic revision checks are sufficient:

```text
command carries expected/base revision
provider accepts when current
or returns a revision conflict
client reloads and retries intentionally
```

This follows the same general stale-write discipline already demonstrated by Spreadsheet without importing a CRDT runtime.

### What is lost by deferring Yjs?

V1 will not provide:

- simultaneous character-by-character editing of the same description;
- offline merge of arbitrary text edits;
- shared cursors/selections;
- text-range annotations that survive arbitrary editing;
- per-user collaborative text undo.

None is required to validate the first real Atom.

### Re-entry criterion for Yjs

Add Yjs or another CRDT only when a concrete requirement appears such as:

> Two or more people must simultaneously edit substantial free-form document content and ordinary revision-conflict handling is materially harming the workflow.

Do not add it merely because the broader Atom architecture can support sophisticated collaboration.

---

## 6. Canonical MVP state

The canonical state is a provider-owned structured Review database, not Markdown text.

Conceptual schema only:

```ts
type AtomId = string;
type ReviewItemId = string;
type CommentId = string;
type RevisionId = string;
type ActorKey = string;

type TestResult =
  | "not_tested"
  | "working"
  | "not_working"
  | "needs_polish";

type Desired =
  | "must"
  | "high"
  | "normal"
  | "later"
  | null;

type Effort =
  | "tiny"
  | "small"
  | "medium"
  | "big"
  | "really_big"
  | null;

type WorkState =
  | "untriaged"
  | "needs_design"
  | "ready"
  | "in_progress"
  | "blocked"
  | "needs_retest"
  | "done"
  | "deferred";

interface ReviewAtom {
  atomId: AtomId;
  atomType: "plasmon.review/v1";
  title: string;
  items: ReviewItem[];
  currentRevision: RevisionId;
  source?: SourceImport;
}

interface ReviewItem {
  itemId: ReviewItemId;
  title: string;
  descriptionMarkdown?: string;

  // Human/test evidence: independent from coordinator state.
  results: Record<ActorKey, ParticipantResult>;

  // Review-specific coordination only.
  coordination: {
    desired: Desired;            // default null / unset
    effort: Effort;              // default null / unset
    owner?: ActorKey | string;   // optional human or named agent reference
    workState: WorkState;        // default untriaged
    blockedBy?: ReviewItemId[];
    dependsOn?: ReviewItemId[];
  };

  comments: CommentId[];
}

interface ParticipantResult {
  actor: ActorKey;
  result: TestResult;
  note?: string;
  updatedAtNs: string;
  updatedByEvent: string;
}

interface Comment {
  commentId: CommentId;
  itemId: ReviewItemId;
  actor: ActorKey;
  actorType?: "human" | "ai" | "system";
  displayName?: string;
  body: string;
  createdAtNs: string;
  replyTo?: CommentId;
}
```

`ActorKey`, `actorType`, and `displayName` are application-domain concepts in the vanilla app unless a stronger platform identity is available. They must not be mistaken for MTN-authenticated identity.

### 6.1 New requirements remain untriaged by default

When a human or AI adds a new Review item, defaults are deliberately:

```text
Desired:    unset
Effort:     unset
Owner:      unset
Work state: Untriaged
```

A newly discovered requirement does **not** automatically become `MUST`, enter the current work queue, or acquire an owner.

This preserves the distinction between:

```text
"we discovered this"
```

and:

```text
"we decided this is current priority"
```

### 6.2 Test evidence remains separate

Valid state:

```text
Brian result:   NOT WORKING
Work state:     NEEDS RETEST
Desired:        MUST
Effort:         Small
Owner:          Agent 2
```

Setting `Work state: DONE` does not rewrite human/test results to `WORKING`. Retesting remains evidence-producing activity.

---

## 7. Typed commands instead of generalized collaboration

The Review provider/background exposes narrow Review operations.

Conceptually:

```text
atom.list
atom.get
atom.createFromMarkdown
atom.open

review.listItems
review.getItem
review.createItem
review.updateItemText
review.setResult
review.setCoordination

comment.list
comment.add
comment.reply

activity.list
history.listRevisions
history.getRevision
history.restoreRevision

export.markdown
```

The exact vanilla tool names are Review-specific and need not become generic Atom contracts.

### 7.1 Vanilla human + agent behavior

The human tile and Neutron agent tools should operate on the same resident/provider state and revisioned command engine, following the useful Spreadsheet pattern.

That proves an AI/agent can structurally inspect and operate on a Review Atom without DOM scraping even before MTN live sharing exists.

Minimum useful agent reads:

```text
list/open Atoms
list items
read results
filter not working
filter needs polish
filter not tested
read Desired/Effort/Owner/Work state
read dependencies/blockers
read comments
read recent activity
read revision history
```

Minimum useful agent writes:

```text
add comment
create review item
set coordinator/work metadata
optionally record an agent's own result/evidence
```

### 7.2 Same-field concurrency

Use an expected/base revision and idempotent command ID, following the existing Neutron Spreadsheet precedent.

For V1:

```text
command(expectedRevision, commandId, operation)
```

If the Atom advanced incompatibly, return a revision conflict and reload. Do not silently last-write-wins a stale edit.

### 7.3 Semantic transaction granularity

A durable provider revision represents one accepted **semantic application transaction**, not low-level UI activity.

Freeze the invariant:

```text
one accepted semantic transaction -> one logical RevisionId
```

Examples:

```text
setResult(item72, NOT_WORKING)
  -> one semantic transaction
  -> one logical RevisionId

setCoordination(item72, {
  desired: MUST,
  effort: Small,
  owner: Agent 2,
  workState: NEEDS_RETEST
})
  -> one atomic semantic transaction
  -> one logical RevisionId

import bounded TODO template with 80 items
  -> one bounded bulk semantic transaction
  -> one logical RevisionId
```

Do **not** create durable provider revisions for:

- keypresses;
- cursor movement;
- focus;
- selection;
- React/component state;
- rendering;
- menu hover/open state;
- other transient UI events.

The UI may have local ephemeral state and may coalesce edits before submitting one typed semantic command. The application transaction boundary is defined by the accepted domain mutation, not by browser event frequency.

A bulk TODO import should likewise be a bounded bulk transaction rather than one provider transaction/revision per imported line.

---

## 8. Comments: item-level only for MVP

MVP comments attach to a stable `ReviewItemId`.

That solves the actual review need:

```text
#72 Text editor opens Monaco
  Brian: focus is incorrect after opening
  AI: likely regression from Open With path
```

Replies may use a simple `replyTo` relationship or flat ordered comments if that is materially faster.

The MVP does **not** require:

- paragraph/block anchors;
- text-range anchors;
- CRDT relative positions;
- rich annotation layers;
- generalized comment protocol shared by every Atom type.

---

## 9. Activity and history: simplify aggressively

The tool should show meaningful recent activity such as:

```text
15:42 Brian       marked #72 NOT WORKING
15:43 Brian       commented on #72
15:45 AI Agent    set #72 work state to NEEDS DESIGN
15:51 Brian       set #72 Desired to MUST
```

This does not require a Git-like history engine.

### 9.1 Append-only meaningful events

Each accepted mutation appends a provider-authored event:

```ts
interface ActivityEvent {
  eventId: string;
  revisionId: RevisionId;
  atomId: AtomId;
  actor: ActorKey;
  actorType?: "human" | "ai" | "system";
  displayName?: string;
  occurredAtNs: string;
  operation: string;
  itemId?: ReviewItemId;
  summary: string;
}
```

For vanilla Neutron, actor labels/type are whatever Review can truthfully derive or has configured. They are not automatically cryptographic/authentication claims.

For the MTN stretch, the authoritative security identity rule is stricter and is defined in section 13.

### 9.2 Durable logical revision per accepted semantic transaction

Freeze the semantic rule:

```text
one accepted semantic transaction -> one logical RevisionId
```

A `RevisionId` identifies the resulting logical historical point in one Atom's application history. It MUST NOT imply a particular physical persistence or publication encoding.

A revision does **not** inherently mean:

- a full serialized Atom snapshot;
- a content-addressed commit;
- a Git tree/blob structure;
- a hash tree;
- a Sharing chunk manifest;
- one immutable provider publication.

For a tiny hackathon implementation, storing a full local snapshot per transaction is acceptable if expedient. That is an implementation choice only and must remain replaceable without changing Atom or RevisionId semantics.

The recommended scalable physical shape is:

```text
normalized/current structured state
        +
append-only semantic transaction/event journal
        +
sparse/occasional checkpoints as an implementation optimization
```

This lets Review reconstruct/inspect historical logical revisions while keeping current-state mutation indexed and proportional to the changed records.

Required logical behavior remains only:

```text
list revisions
inspect revision
restore revision
```

### 9.2.1 Live structured Atom state is not snapshot publication

Freeze a second independent invariant:

> **Immutable snapshot/chunk/content-addressed publication is not the universal persistence model for live structured Atoms.**

Agent 9's immutable snapshot/chunk publication model remains appropriate for resources such as:

- immutable shared snapshots;
- files/blobs;
- attachments;
- archives/backup;
- portable Atom exports;
- large binary Atom resources.

It must not force live Review mutations through whole-Atom serialize/hash/chunk/publish cycles.

Conceptual cost invariant:

```text
setResult(item72, ...)
```

or:

```text
setCoordination(item72, ...)
```

must be implementable with work proportional to the changed records plus small revision/event bookkeeping, **not proportional to total Atom size**.

The design does not freeze a particular database, index, log, checkpoint format, storage engine, or compaction strategy. It freezes only the logical and cost boundaries needed to keep live Atoms scalable.

### 9.3 Whole-Atom restore instead of generalized selective revert

The recovery mechanism is:

> **Restore the whole Atom to revision R.**

Restore creates a **new current logical revision** whose contents equal the selected historical logical revision.

Example:

```text
R103 mistaken destructive change
R104 later mutation
R105 owner restores state from R102
```

History remains visible:

```text
R103 destructive mutation
R104 later mutation
R105 restored Atom from R102
```

The provider never rewrites or deletes prior history.

Restoring historical state does not require Git-like commits, trees, branches, or content-addressed storage. It is a semantic operation:

```text
restore historical logical revision
  -> apply historical state as current state
  -> append restore event
  -> create new current logical RevisionId
```

### 9.4 Why generalized event-level revert is not MUST

Selective dependency-aware revert requires substantially more machinery:

- semantic inverse operations;
- dependency analysis;
- conflicts with later mutations;
- previews;
- partial rollback behavior.

Review Atoms are small and human-readable, so whole-Atom restore is sufficient for V1.

### 9.5 No sophisticated retention design yet

For hackathon data volume, retain enough journal/checkpoint history to satisfy the required logical revision behavior. A tiny implementation may retain all logical revisions and even full local snapshots if convenient.

Do not build:

- history compaction algorithms as a product feature;
- CRDT garbage collection policy;
- branch graphs;
- merge commits;
- Git-like ancestry;
- content-addressed commit trees merely to represent RevisionIds.

Checkpoint frequency, journal compaction, and physical retention are implementation concerns that can be tuned after measuring actual data volume without changing RevisionId semantics.

---

## 10. Markdown/TODO import and export

Markdown remains a portable representation, not the canonical Review database.

### Import

Input:

```markdown
- [ ] Text editor opens Monaco
- [ ] Download works
- [ ] Shortcut execution works
```

Import produces stable Review items:

```text
item A -> Text editor opens Monaco
item B -> Download works
item C -> Shortcut execution works
```

The imported Markdown checkbox value does not become shared participant evidence. It is source/template information only unless the Review import policy explicitly maps it to a separate source-status field.

### Export

Export produces readable Markdown/TODO output.

A simple export may include coordinator summaries:

```markdown
- [ ] Text editor opens Monaco
  - Desired: MUST
  - Effort: Small
  - Owner: Agent 2
  - Work state: Needs retest
  - Results: 1 working, 1 not working, 1 needs polish
```

Participant details/comments can optionally be emitted beneath items or into a report section.

The exact export style is Review-specific. It does not need to round-trip every historical event into Markdown.

### Source relationship

Import creates an Atom-owned working object. It does not live-edit the source file.

For MUST, **Export** or **Export As** writes a new readable Markdown/TODO snapshot through ordinary Neutron Files behavior.

Explicit apply-back to the original source with etag/hash conflict checking is HIGH after MVP. Two-way live filesystem synchronization is ADVANCED and not required.

---

## 11. Absolute minimum generic Atom contract for the vanilla MUST gate

The vanilla MUST gate should **not** force Plasmon to freeze a large new generic Atom API merely to implement Review.

The minimum architectural invariants are:

```text
AtomId     stable logical identity
AtomType   application-defined logical type
ElementId  package/application identity
```

and:

```text
AtomId
!= ElementId
!= physical app instance/AppScope
!= source path
!= source bytes
!= revision
```

Review must demonstrate internally that one Element installation can create/list/open multiple AtomIds.

The **behavior** required is:

```text
create logical Atom
list logical Atoms
open logical Atom
read current state
mutate through typed commands
export
```

These can initially be Review-owned provider/tool operations. A generic platform API does not need to be frozen before the vanilla app is useful.

### 11.1 What remains Review-specific

The generic Atom platform does **not** need to understand:

- `working` / `not_working` / `needs_polish` / `not_tested`;
- Desired priorities;
- Effort sizes;
- Owner assignment;
- Work state;
- dependency/blocker references;
- comments;
- revision presentation;
- Markdown/TODO import/export rules;
- consensus/query views;
- AI review queries;
- sprint-like filtered views.

Those belong to the Review Element.

### 11.2 No generic Sharing contract is required for MUST

Because MTN live sharing is HIGH / stretch, the vanilla acceptance gate does not require a generic Sharing contract at all.

This is an intentional contraction.

### 11.3 Generic contract redlines to preserve later

When generic Atom/Sharing contracts do harden, they must preserve both redlines proven by Review:

```text
RevisionId = logical application-history identity
RevisionId != required physical encoding/publication object
```

and:

```text
live structured Atom state
  != mandatory immutable snapshot/chunk publication
```

A generic contract may support snapshot publication as one operation/resource form, but it must also permit indexed structured live-state mutation without forcing whole-resource republishing for each semantic change.

These are generic architecture boundaries, not requirements to freeze a storage API or database engine now.

---

## 12. MUST for hackathon — vanilla Neutron

These are necessary to prove the base Atom abstraction and make the dog-food tool useful.

### Packaging/runtime

- Package and install as a normal `Review.neutron` application.
- Run productively on stock/vanilla Neutron with no Plasmon/MTN dependency.
- Use normal Neutron app conventions and capabilities rather than custom-kernel behavior.
- Use a persistent background/provider surface suitable for canonical Review state.

### File/open behavior

- **File > Open** reads Markdown/TODO through ordinary Neutron Files access.
- First import creates a logical Review Atom with a stable AtomId.
- Reopen existing local Review Atoms from the Review-owned catalog without requiring the source file.
- Source file/path is provenance, not Atom identity.
- No special `.atom`/`.review` native file is required.

### Atom proof

- **Multiple logical Review Atoms inside one physical Review Element installation.**
- Stable logical `AtomId` distinct from the physical installation/AppScope.
- Create/list/open enough to operate those Atoms independently.
- Stable `ReviewItemId`s that survive ordinary item text/coordinator changes.
- One accepted semantic application transaction creates one logical `RevisionId`.
- `RevisionId` does not freeze snapshot, Git, content-addressed, chunk-manifest, or provider-publication encoding.

### Review data model

- Import Markdown/TODO into stable Review items.
- Add a new Review item.
- New items default to:

```text
Desired:    unset
Effort:     unset
Owner:      unset
Work state: Untriaged
```

- Test evidence values:

```text
NOT TESTED
WORKING
NOT WORKING
NEEDS POLISH
```

- Evidence is stored independently per actor/participant record rather than in one shared checkbox.
- Review-specific coordinator metadata:

```text
Desired: MUST / HIGH / NORMAL / LATER / unset
Effort: Tiny / Small / Medium / Big / Really Big / unset
Owner: optional actor/agent
Work state:
  Untriaged
  Needs design
  Ready
  In progress
  Blocked
  Needs retest
  Done
  Deferred
optional dependency/blocker item references
```

- Test evidence and coordinator metadata remain separate dimensions.

### Comments and agent operation

- Item-level comments append rather than overwrite.
- Human tile and agent tools operate on the same structured Review state.
- AI/agent can structurally read Review state without DOM scraping.
- AI/agent can comment and update separate coordinator metadata through typed Review commands when the local Review policy permits.
- Basic expected-revision conflict protection prevents stale same-field mutation from silently winning.
- A coordination command may atomically update Desired/Effort/Owner/Work state in one semantic transaction/revision.
- A bounded TODO import is one bounded bulk semantic transaction rather than one durable provider transaction per line.
- Transient UI events do not create durable provider revisions.

### Activity/recovery

- Meaningful recent activity feed.
- Durable logical revisions sufficient to inspect historical Atom state.
- Recommended scalable persistence shape is current normalized state + semantic event journal + sparse/occasional checkpoints.
- Small-field mutations can be implemented proportional to changed records plus small revision/event bookkeeping rather than total Atom size.
- Owner/local authoritative Review user can restore the entire Atom to a historical revision.
- Restore creates a new logical revision and preserves old history.
- No generalized selective-revert engine.
- No Git-like storage/history requirement.

### Portability

- Export current Atom to readable Markdown/TODO form through normal Files behavior.

### Explicitly not required for MUST

- MTN;
- Plasmon Desktop;
- shared URLs;
- cross-AppScope leases;
- authenticated multi-user live sharing;
- custom-kernel behavior;
- Yjs/CRDT;
- special Atom native file format;
- immutable snapshot/chunk publication for live state;
- Git/content-addressed revision encoding.

If these work on vanilla Neutron, the first hackathon gate passes.

---

## 13. HIGH / hackathon stretch — Plasmon + frozen MTN 0.2

The high-value stretch demo uses the **same Review.neutron** rather than a second Plasmon-only application:

```text
shared Review Atom URL
  -> custom Plasmon/MTN environment
  -> find/install Review Element if necessary
  -> redeem authorized Atom
  -> expose/open the Atom with minimal user work
  -> authenticated humans + AI operate on the same live Atom
```

The demo should make the contrast visible:

```text
vanilla Neutron:
  normal File > Open / local Review Atom workflow works

Plasmon + MTN:
  shared live Atom opens with dramatically less setup
  and authenticated cross-user operation becomes possible
```

Do **not** assume MTN 0.3 is required. The working assumption is that frozen MTN 0.2 may be sufficient, with Plasmon owning the bootstrap/discovery/install/open UX around it.

### 13.1 MTN 0.2 rights are frozen and coarse

The MTN 0.2 rights are exactly:

```text
#read
#write
#reshare
```

Do **not** invent or document Review-domain operations as MTN rights.

The following are **not** MTN rights:

```text
review.set_own_result
review.coordinate
comment.add
history.restore
```

They are Review-domain operations/policies executed under the applicable MTN authority.

Conceptually:

```text
MTN #read
  -> may authorize reading/querying the shared Review resource

MTN #write
  -> may authorize Review mutation calls
  -> Review still applies its own domain invariants/policy

MTN #reshare
  -> may authorize resharing/delegation behavior
```

Review may impose narrower application semantics beneath `#write`. For example, a `setMyResult` command can require that the target evidence slot correspond to the authenticated caller, and an owner-restore command can require Review-domain ownership/policy. Those checks do not create new MTN rights.

No MTN 0.2 change is required.

### 13.2 Authoritative attribution

For MTN-authorized provider calls:

> **`AuthorizationContext.subject` is the authoritative authenticated principal.**

Review must use that subject whenever a security-relevant mutation or attribution depends on who the caller is.

Review may additionally record application metadata such as:

```text
actorType: human | ai
friendly display name
tool/agent name
integration label
```

but those fields are application-domain metadata unless independently authenticated.

They must never supersede, replace, or contradict `AuthorizationContext.subject`.

Correct shape conceptually:

```text
security identity:
  subject = AuthorizationContext.subject

optional presentation/domain metadata:
  actorType = ai
  displayName = "Agent 2"
```

not:

```text
client says actorType/name
  -> therefore client chooses authenticated identity
```

### 13.3 Minimal live Sharing path

Do not change MTN 0.2.

The approved architecture's key conclusion remains: the Review Atom is a live revision-free authorization resource, not a snapshot URL.

Minimal stretch flow:

```text
owner has logical Review Atom
  -> Plasmon maps Atom to stable revision-free MTN resource
  -> issue MTN grant
  -> produce share URL
  -> recipient opens URL
  -> Plasmon safely discovers enough to find/install Review
  -> exact recipient AppScope redeems
  -> live MTN lease
  -> recipient performs lease-bound Review provider calls
```

The Atom's current Review revision is application state, not MTN resource identity.

Agent 9's immutable snapshot/chunk/content-addressed publication model remains valid for immutable publication use cases, but it must **not** become the universal persistence or mutation model for a live Review Atom.

For live structured state, MTN authorization and Plasmon bootstrap/sharing may identify and authorize the stable Atom resource while Review mutates indexed provider-owned application state directly. A small field update must not require publishing a fresh whole-Atom immutable snapshot merely because Sharing also supports snapshot resources.

This does not expand or change MTN 0.2. It is a Plasmon/Atom persistence and Sharing boundary.

### 13.4 Absolute minimum generic Sharing integration

Only the HIGH/stretch path needs a generic Sharing bridge:

```text
stable Atom/resource identity
resolve required/compatible Element
redeem authorization for exact consumer AppScope
retain/use live lease for provider calls
revoke through MTN
```

The generic layer must preserve:

```text
AtomId
!= ElementId
!= physical app_instance_id/AppScope
!= grant/bearer token
!= Review revision
```

It must also preserve the distinction:

```text
live authorized resource mutation
  != mandatory immutable snapshot publication
```

Plasmon owns bootstrap UX around frozen MTN semantics; Review owns Review-domain behavior.

### 13.5 High-value stretch features

- Shared Review Atom URL.
- Plasmon finds/installs Review Element when absent.
- Minimal-click redemption/open.
- Authenticated multi-human operation on one live Atom.
- AI principal/integration operates on same live resource.
- Independent human evidence remains separate.
- MTN revocation stops future authorized operations.
- `AuthorizationContext.subject` appears as authoritative actor identity in activity/history.
- Optional Review-domain display metadata distinguishes humans/AI for UX without weakening subject authority.

---

## 14. HIGH after MVP

These are likely valuable soon, but should not delay the vanilla MUST proof.

- The Plasmon + MTN 0.2 live-share stretch in section 13 if it misses the hackathon base gate.
- Explicit apply-back to source Markdown with source etag/hash conflict checks.
- Lossless Atom backup/archive format if migration/backup becomes necessary.
- Better same-field conflict UI for item descriptions/coordinator fields.
- Comment resolution/reopen and richer reply threading.
- Saved filters/views, including a simple "sprint" query over Desired/Owner/Work state.
- Assigned-reviewer lists and clearer `NOT TESTED` coverage views.
- Test/retest cycles preserving old evidence while requesting fresh evidence.
- Selective event/item revert if whole-Atom restore proves too coarse.
- Better revision diff UI.
- Activity filtering by actor/item/time.
- Alternative compatible Element routing after Atom protocol/type contracts mature.

Yjs remains out until real collaborative free-form editing becomes a demonstrated requirement.

---

## 15. ADVANCED

These capabilities show how sophisticated future Atoms can become but are intentionally outside the first Review tool.

- Yjs/Automerge or another CRDT for arbitrary simultaneous document editing.
- Offline-first multi-writer merge.
- Text-range comments with durable relative anchors.
- CRDT presence/cursors/selections.
- Per-user collaborative text undo.
- Change-by-change dependency-aware selective revert.
- Historical branching/merge-like workflows.
- Sophisticated checkpoint compaction/retention.
- Rich document blocks and generalized annotations.
- Cross-Atom dependencies beyond lightweight Review blocker references.
- Compatible Elements selected through a Powerbox-like chooser.
- Owner-compute versus recipient-compute execution choices.
- Portable full Atom archives with migrations between compatible Elements.
- General Atom collaboration protocols if multiple unrelated Elements demonstrate common requirements.
- Live two-way filesystem synchronization.

These remain compatible with `FIRST_COLLABORATIVE_ATOM_DESIGN.md`. They are simply not evidence the hackathon needs yet.

---

## 16. Minimal sequence flows

### 16.1 Vanilla: create Atom from TODO

```text
User opens Review.neutron
  -> File > Open
  -> Review requests normal Files access
  -> read /todo.md
  -> parse TODOs into stable ReviewItemIds
  -> allocate logical AtomId
  -> persist bounded imported item set as one semantic transaction
  -> create logical revision R1
  -> open Atom
```

### 16.2 Vanilla: reopen without source file

```text
User opens Review.neutron later
  -> Recent Reviews / Open Review
  -> choose AtomId 01J...
  -> provider loads canonical structured state
  -> source file does not need to exist
```

### 16.3 Vanilla: human records evidence

```text
Brian marks #72 NOT WORKING
  -> typed Review mutation
  -> expected revision checked
  -> Brian's evidence record updated
  -> one semantic transaction accepted
  -> logical revision R12
  -> meaningful activity event
```

### 16.4 Vanilla: agent coordinates without DOM scraping

```text
AI/agent tool reads Atom
  -> sees #72 NOT WORKING
  -> sees Desired unset, Work state Untriaged

agent command:
  -> add comment
  -> set Work state = NEEDS DESIGN
  -> optionally set Desired = MUST if local policy permits

Brian's evidence remains unchanged
```

A single coordination command may atomically update Desired/Effort/Owner/Work state and produce one logical revision rather than one revision per field.

### 16.5 Vanilla: owner recovers from mistake

```text
R40 good state
R41 destructive/mistaken changes
R42 more changes

Owner selects "Restore R40"
  -> provider reconstructs/reads historical logical R40
  -> writes current state equivalent to R40
  -> creates new logical revision R43
  -> activity says "restored Atom from R40"

R41/R42 remain in history
```

No Git tree/commit representation is implied by this sequence.

### 16.6 Stretch: shared URL

```text
Alice opens shared Review Atom URL
  -> Plasmon bootstrap identifies/fetches Review Element as needed
  -> exact Alice consumer AppScope redeems via MTN 0.2
  -> live lease
  -> Review provider receives MTN-authorized call
  -> AuthorizationContext.subject = Alice principal
  -> Review applies domain operation under #read/#write authority
```

### 16.7 Stretch: AI mutation attribution

```text
AI principal calls Review under MTN #write
  -> MTN authenticates AuthorizationContext.subject
  -> Review records subject as authoritative actor principal
  -> Review may also display actorType=ai / friendly agent label
  -> typed coordinator/comment mutation accepted if Review policy allows
  -> activity event + logical revision
```

---

## 17. Acceptance summary

### MUST / hackathon base

Prove on **stock vanilla Neutron**:

```text
Review.neutron installs and opens normally
  -> File > Open Markdown/TODO
  -> source becomes a logical Review Atom
  -> source != Atom
  -> one Review installation owns multiple AtomIds
  -> stable ReviewItemIds
  -> independent evidence
  -> Desired/Effort/Owner/Work state
  -> comments
  -> human + agent structured operations
  -> semantic transactions
  -> one logical RevisionId per accepted semantic transaction
  -> activity
  -> durable logical history
  -> whole-Atom restore creates a new logical revision
  -> Markdown/TODO export
```

Physical persistence remains free to evolve from expedient hackathon snapshots toward normalized current state + event journal + sparse checkpoints without changing Atom semantics.

### HIGH / stretch

Demonstrate with the same app in custom Plasmon/MTN environment:

```text
shared URL
  -> find/install Review
  -> redeem/open live Atom
  -> authenticated humans + AI
  -> MTN 0.2 #read/#write/#reshare only
  -> AuthorizationContext.subject authoritative
  -> live state does not require whole-Atom snapshot publication per mutation
  -> revocation enforced
```

### ADVANCED

Only after product evidence requires it:

```text
CRDT document collaboration
fine-grained anchors/presence/undo
selective dependency-aware revert
complex retention/branching
full generic collaboration abstractions
```

---

## 18. Final recommendation

Build the first Review Atom as a **small, normal vanilla-Neutron structured review application**.

The base architecture should be:

```text
Review.neutron
  -> normal Neutron tile + persistent background/provider
  -> normal Files access

Review Element installation
  -> many logical AtomIds

Review Atom
  -> stable ReviewItem records
  -> independent test evidence
  -> lightweight Review-specific coordination fields
  -> item comments
  -> typed human/agent semantic transactions
  -> append-only meaningful activity/event journal
  -> logical RevisionIds
  -> normalized/current structured state
  -> sparse/occasional checkpoints as an implementation optimization
  -> whole-Atom restore creates a new logical revision
  -> Markdown import/export
```

A tiny implementation may use full snapshots for convenience, but neither `AtomId` nor `RevisionId` implies a snapshot, Git commit/tree, hash tree, chunk manifest, or immutable provider publication.

Live structured Review mutations must be capable of touching only changed records plus small revision/event bookkeeping. Immutable snapshot/chunk publication remains available for snapshot/file/blob/archive/export use cases rather than becoming universal live Atom persistence.

No MTN or Plasmon dependency is required for that base application.

Then, as a HIGH-value hackathon stretch, let Plasmon + frozen MTN 0.2 improve the same app:

```text
same Review.neutron
  -> live shared Atom URL
  -> bootstrap/find/install/open
  -> #read / #write / #reshare authorization
  -> AuthorizationContext.subject as authoritative principal
  -> authenticated humans + AI operate on the same live Atom
```

No MTN 0.2 expansion is required.

Specifically defer Yjs/CRDT collaboration until actual usage demonstrates a requirement for simultaneous free-form text editing.

The contracted proof is therefore:

```text
MUST:
Element -> multiple logical Atoms -> useful on vanilla Neutron

HIGH / stretch:
same Atom model -> Plasmon + MTN live share -> authenticated human + AI collaboration
```
