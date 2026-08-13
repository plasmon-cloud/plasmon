# Issue #194 — future Start state model

Observable state only; this does not prescribe #169's controller API.

```text
closed | root(folderId) | folder(folderId, trail) | loading | empty | error
+ query/filter + focused item
-> Start rendered surface
```

| State/event | Guard | Expected observable result | Authority |
|---|---|---|---|
| closed -> open | reconciliation/root available | root listing or loading | Shell coordination + FsService |
| open root -> child folder | node is directory | trail appends NodeId; child loading/listing | FsService |
| folder -> back | trail length > 1 | previous NodeId listing | Start surface state |
| open shortcut | valid parsed shortcut | activation request; surface closes on success | FilesystemOpenDispatcher |
| open broken target | dispatcher rejects | visible action error; no fake process | Open authority |
| list failure | FsService rejects | alert/error state; retry only if existing policy supports | FsService |
| empty folder | listing succeeds, zero visible nodes | stable empty message | Start surface |
| query changes | local filter only | visible subset; durable tree unchanged | pure view model |
| filesystem event | current tree affected | refresh current folder; preserve valid trail | FsEventSource/FsService |
| user rename/move/delete | reconciliation rerun | display reflects actual tree; no recreation absent managed proof | FsService + #169 |
| Escape/outside | shell policy | close surface; focus return characterized | Shell transient controller |
| Start/Search toggle | other flyout open | one active flyout | Shell global |
| keyboard Arrow/Home/End | visible items exist | focus moves deterministically | DOM adapter |
| Enter | focused node exists | same activation as pointer | canonical opener |

## Characterization set

Use real headless FsService for tree/reconciliation/identity/preservation and RTL
for the rendered Start interaction. Do not cause reconciliation merely because a
React render occurred in a test; invoke the production boot/controller boundary
explicitly once #169 defines it.
