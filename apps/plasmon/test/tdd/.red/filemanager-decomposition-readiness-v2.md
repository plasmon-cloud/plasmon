# FileManager decomposition readiness v2

Refresh: integrated release `f4ac3b4`. PR #204/#191 is active implementation
ownership — **ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH**. This audit
excludes its unmerged branch and does not finalize #195.

| Responsibility | Current authority/seam | Deterministic? | React-only? | Browser-only? | Existing evidence | After #191 inspection |
|---|---|---:|---:|---:|---|---|
| listing/loading | FsService + `RefreshGate` | yes | adapter state | no | file-manager tests | verify parent seam |
| refresh generations/events | `RefreshGate`, `FsEventSource` | yes | subscription adapter | no | refresh tests | preserve |
| selection/focus | model selection helpers + DOM focus | policy yes | focus adapter | focus browser | FileManager tests | verify FileEntry callbacks |
| keyboard | `fileManagerKeyboardCommand`, inline handler | mostly | event adapter | focus only | keyboard tests | common vs view semantics |
| rename command | `renameNode`/FsService | yes | inline editor state | editor geometry | rename tests | selected-label vs editor seam |
| activation/navigation | `activateFileManagerNode`, open authority | yes | callback | no | activation tests | preserve |
| clipboard | `FileOperationClipboard`, paste helper | yes | command buttons | no | clipboard tests | operation status dependency #65 |
| operation state | imports/drag currently local opaque loops | incomplete | yes | visible status RTL | #65 packet active | inspect accepted #65 first |
| Trash/delete | `deleteFilesystemNodes` + Trash authority | yes | confirmation/error adapter | no | delete tests | preserve |
| shortcut | create/read shared shortcut helpers | yes | command adapter | no | shortcut tests | preserve |
| Properties/Open With | panels + AssociationRegistry/OpenService | model yes | dialog adapter | focus/geometry | properties tests | preserve authority |
| context menu | local menu state + policy branches | policy yes | DOM menu | placement/focus | gate tests | extract adapter candidate |
| drag/drop | model validation/move + pointer refs/RAF | split | substantial | pointer capture/hit testing | drag/drop tests | verify FileEntry seam |
| marquee | pure rectangle/selection helpers + DOM refs | split | yes | real rects | model tests | keep browser boundary |
| thumbnails | FileEntry/thumbnail policy + Visual | split | presentation | decode/browser | icon/thumbnail tests | #190/#93 dependencies |
| hidden state | Fs list options/preferences | yes | input adapter | no | #110 packet | do not alter active packet |
| view preference | parent props `presentation` | yes | rendering | geometry | component tests | #196 strategy boundary |
| errors | local `error`/ErrorBanner | yes | yes | no | error tests | common command error adapter |
| file input/import | hidden input + `importFileIntoFs` loop | command yes | event adapter | browser chooser only | #65 active | inspect accepted #65 |
| download | `downloadFsNode` | yes | browser download adapter | download boundary | gate test | preserve |

## Readiness disposition

**CHARACTERIZATION READY; FINALIZE AFTER #191 INTEGRATES.** The current
production graph has enough lower seams to preserve behavior, but #195's final
RED must inspect the surviving #191 FileEntry state/presentation seam, async
adapter, selected-label boundary, and retired tests before asserting extraction.
