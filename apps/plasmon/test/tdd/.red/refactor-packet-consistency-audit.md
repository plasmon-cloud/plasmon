# r2 Desktop/FileManager packet consistency audit

Compared packets: #189, #190, #191, #192, #195, #196 reconnaissance, #44,
#51, #52, #65, #66, #86, #92, #93, #94, #95, #108, #110, #115, #176.

## Consistent authority claims

- **NodeId:** filesystem owns identity; rename/move/Trash/shortcut/open preserve
  it. #191/#192/#44/#51/#92 all agree.
- **Classification:** #189 owns derived resource classification; #190/#52
  consume it and Visual does not infer MIME/suffix semantics.
- **Presentation:** #190/#52 own resolved icon/thumbnail/overlay composition;
  #93 consumes containment; #191/#95 concern label geometry, not icon identity.
- **Desktop placement:** #192 owns coordinate repair/persistence; #191/#95
  must not move positions to fit labels.
- **Shortcuts:** #44 owns canonical primitive; #51 adds Desktop destination;
  neither copies/moves the original or invents another format.
- **Operations:** #65 owns import/paste progress vocabulary; #92 must reuse it
  for drag moves and must not create a competing job manager.
- **Browser boundaries:** #66 owns drag-preview stacking, #86 text selection,
  #94 media decode, #176 first-party context ownership, and #190 package asset
  loading. None transfers domain authority to the browser layer.
- **Navigation/preferences:** #108 owns transient history; #110 owns durable
  filesystem-backed visibility preference. Neither changes resource identity.

## Important qualification (not a conflict)

#95 permits selected labels to expand beyond the compact icon footprint, while
#191's current RED gate requires the *rename editor* to remain bounded by its
FileEntry tile. These are distinct selected-label versus inline-editor claims;
implementors must preserve that distinction. If one implementation uses a
single DOM surface for both, acceptance must explicitly reconcile it rather than
silently weakening either packet.

#93 calls the current runtime thumbnail path green despite a stale `.fm-entry`
CSS selector using `cover`; #190's shared presentation packet independently
requires thumbnail containment. This is a dead-selector cleanup concern, not a
behavioral contradiction, but an implementor should remove stale authority only
when safe.

## No specification conflict found

No exact contradictory authority or user-visible claim was found among the
reviewed packets. #196 remains architecture-dependent on #195, and #92 remains
blocked on #65's future accepted operation vocabulary; those are dependencies,
not conflicts.

## Implementation handoff constraints

1. Land #189 classification seam before migrating #190 presentation consumers
   that need semantic type output; keep AssociationRegistry separate.
2. Land/accept #65 operation state before #92 drag progress.
3. Fix #190 installed asset root and remove #187 temporary health allowances;
   do not mark unit URL constants as packaged acceptance.
4. Keep #51 consumer thin over #44's primitive and preserve Desktop destination
   policy.
5. Do not start #196 architecture RED or source-shape tests until #195's
   surviving view seam is observable.
