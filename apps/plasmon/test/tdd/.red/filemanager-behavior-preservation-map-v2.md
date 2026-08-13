# FileManager future implementor preservation checklist

**ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH:** #191/PR #204 and today's
#51/#65/#190 branches are excluded. This checklist targets future #195/#196.

| Behavior | Canonical authority | Existing protection |
|---|---|---|
| selection/additive/range/focus | FileManager model selection helpers + NodeId | `file-manager.test.ts`, selection tests |
| activation/double click/Enter | FileManagerOpenAuthority + Association/Open | `fileManagerActivation.test.ts`, activation tests |
| rename/NodeId | FsService rename + `renameNode` | rename/identity tests, FileEntry tests |
| clipboard copy/cut/paste | `FileOperationClipboard` + FsService | clipboard/model tests |
| Trash/delete/partial failure | Trash authority + delete helper | `fileManagerDelete.test.ts` |
| shortcut | shared shortcut primitive + FsService | `create-shortcut`/shortcut tests |
| context menu | FileManager command policy and OpenWith/Properties authority | `gate3.test.tsx`, property tests |
| drag/drop move | `moveNodesToDirectory` + FsService | drag/model tests; #92 waits #65 |
| marquee | rectangle capture + `marqueeSelection` | model tests; browser for real rects |
| navigation/refresh | FsService + RefreshGate + FsEventSource | FileManager tests |
| Properties | Properties loader + FsNode/AssociationRegistry | properties tests |
| Open With | AssociationRegistry/OpenWith model/OpenService | associations/openWith tests |
| thumbnails/presentation | Visual/FileEntry/thumbnail policy | icon/thumbnail tests; #190 active |

Future extraction is green only when this list remains covered at the lowest
truthful layer and common commands are invoked, not reimplemented by views.
