# FileManager drag/drop authority map

Refresh: integrated release `82f176a6`. #66 and #176 remain active/unattended
ownership; this map does not create competing RED packets.

| Concern | Deterministic authority | Browser mechanism | Visual layer | Mutation/result |
|---|---|---|---|---|
| selected drag set | selection state + `finishEntryDragGesture` | pointer capture | FileEntry temporary transform / future #66 preview | NodeIds preserved |
| folder eligibility | `directoryDropTargetId` | `elementFromPoint` supplies candidate | drop-target state | invalid/self/source folder rejected |
| move validation | `moveNodesToDirectory` | pointer release | status/fallback | FsService move sequence |
| filesystem move | FsService | none | refresh | source NodeIds preserved, parent changes |
| Desktop reposition | `onDesktopReposition` -> `repositionDesktopNodes` / #192 controller | pointer delta/bounds | desktop entry transform | persisted positions, no FS mutation |
| multi-selection | ordered selected NodeIds | pointer gesture | preview represents set | one operation; #92 currently RED for missing drag status |
| invalid target | drop target helper | hit testing | no accepted target | selection/position remains |
| cancellation | `finishEntryDragGesture(..., true)` | pointercancel/capture release | cleanup transform/classes | no mutation |
| preview stacking | #66 concrete packet | real stacking/hit testing | separate top-level preview expected | no FileManager policy change |
| context ownership | #176 | browser contextmenu event | foreign surfaces protected | no global interceptor |
| copy vs move | clipboard/command semantics | no drag claim unless accepted | not inferred from CSS | FileOperationClipboard/FsService |

## Required future assertions

- deterministic eligibility and mutation are tested headlessly;
- browser tests prove only pointer capture, `elementFromPoint`, transforms,
  stacking, cleanup and actual drop target behavior;
- NodeId identity and Trash/association/open authority remain unchanged;
- #92 reuses the accepted #65 operation authority; #65 is integrated, but
  drag-specific lifecycle remains a separate RED.
- no test-local drag policy or competing preview implementation is added.
