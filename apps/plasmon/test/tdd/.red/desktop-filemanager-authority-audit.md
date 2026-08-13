# Desktop/FileManager authority audit — r2 TDD-A overnight

Date: 2026-08-13
Scope: active `apps/plasmon/src/os/desktop`, `file-manager`, filesystem and
resource-presentation consumers. This is a staging report, not a production
refactor plan.

## Authority inventory

| Responsibility | Canonical authority | Consumers | Existing evidence | Missing/remaining guard | Issue | Refactor safety |
|---|---|---|---|---|---|---|
| Filesystem node identity, rename, move, copy, bytes | `FsService`/managed filesystem | Desktop, FileManager, Properties, apps | fs tests, refactor guards, cross-surface open | progress/cancellation is intentionally not byte-level | #65/#92 | safe if NodeId preserved |
| Resource semantic classification | `resourcePolicy.ts` plus future #189 seam | Search, FileManager, Properties, native apps | resource policy, activation, search projection tests | MIME/extension precedence and system Search category | #189 | safe after one seam is observable |
| Handler matching/defaults | `AssociationRegistry`, `OpenWithServiceModel` | FileManager, Properties, Shell, open dispatcher | association/Open With suites | no new duplicate matcher | #189/#115 | safe; do not move into Visual |
| Canonical opening/dereference | `FilesystemOpenDispatcher` | FileManager activation, Start, Search, Desktop | activation, desktopCore, cross-surface tests | none identified | #31/#44/#51 | safe |
| Shortcut serialization/target | `fs/shortcut.ts` | FileManager Create Shortcut, seeds, Start | create-shortcut, desktopCore, activation | Send to Desktop consumer absent | #44/#51 | safe; delegate only |
| Trash/protection/restore | protected FS + Trash authority | FileManager delete, Desktop, Recycle Bin | delete/trash lifecycle, refactor guards | none for current queue | #40/#77 | safe |
| Selection/range/marquee identity | FileManager `model.ts` | FileManager/desktop adapter | file-manager/model and RTL guards | per-view keyboard policy remains unspecified | #195/#196 | safe if model remains NodeId-based |
| FileManager refresh/event reconciliation | `RefreshGate`, `isFsEventRelevant`, Fs events | FileManager, Properties, Recycle Bin | file-manager tests, prefs tests | operation state must not race refresh | #65/#92 | safe after operation seam |
| Desktop coordinate policy | `layout.ts` / #192 controller gate | Desktop and FileManager desktop presentation | layout and #192 RED tests | duplicate slots/out-of-bounds/restore collisions | #192 | implement before broad Desktop refactor |
| Desktop position persistence | Desktop metadata + FsService | Desktop | desktop tests, refactor guards | preserve unrelated NodeIds on repair | #192 | safe after controller |
| File entry presentation identity | #189 classification + #190 Visual presentation | FileEntry, Properties, Search/Shell | file-icons and visual suites | packaged asset root currently wrong | #52/#190 | safe after package path fix |
| Shortcut visual composition | `composeShortcutPresentation`, `ResourceIcon` | FileEntry, Properties, Shell | visual components, file-icons | no duplicate overlay/glyph table | #52/#190 | safe |
| Image thumbnail loading/lifecycle | `thumbnail.ts` + shared Visual framing | FileEntry | polish/file-icons/visual tests | aspect behavior is green; legacy dead CSS remains | #93 | safe, avoid source-shape cleanup as feature |
| Video thumbnail extraction | none currently | FileEntry/Visual future | native video MIME tests only | bounded eligibility, frame decode, cleanup | #94 | browser/media boundary; do not fake |
| Clipboard copy/cut/paste | `FileOperationClipboard` + clipboard/model helpers | FileManager keyboard, toolbar, context | model/gate/polish tests | visible progress lifecycle absent | #65 | safe once operation model exists |
| Import/create/download | bounded FileManager helpers over FsService | FileManager toolbar/context/input | final-gate and polish tests | visible import progress absent | #65 | safe |
| Drag-vs-click/group identity | `drag.ts` + model pointer decision | FileManager | file-manager/final-gate tests | top-level preview absent | #66 | safe if preview is presentation-only |
| Directory drop validation/move | `drop-target.ts`, `validateDirectoryDrop`, `moveNodesToDirectory` | FileManager | file-manager tests | truthful multi-item progress absent | #92 | wait for #65 vocabulary |
| Drag preview layering | none | FileManager/Desktop/window stack | #66 browser RED packet | browser stacking/pointer continuity | #66 | must not move Windowing z authority |
| Context menu event ownership | specialized FileManager/Shell/native handlers | FileManager, Shell/taskbar, apps | gate3, packaged smoke | first-party policy not yet unified across surfaces | #176 | browser boundary; preserve foreign content |
| FileManager diagnostics/errors | ErrorBanner + local error state | FileManager/Desktop/Explorer/Properties | polish and RTL structure tests | actual selectable text | #86 | narrow CSS/browser change |
| Explorer navigation history | `ExplorerNavigationModel`/`ExplorerHistory` | Explorer toolbar/address/sidebar/FileManager callback | navigation tests and golden path | current implementation green | #108 | safe |
| Hidden-file semantics | managed FS `isDotHiddenName`/`includeHidden` | FileManager visibility, Explorer, Search | desktopCore/preferences/refactor guards | visible packaged/manual preference acceptance | #110 | safe; no filename policy in UI |
| Durable view preferences | filesystem root metadata stores | Explorer/FileManager/Shell | preferences and shell preference tests | no localStorage authority | #110 | safe |
| Properties/Open With presentation | Properties + shared Visual, OpenWith model | FileManager/native Properties | file-manager/open-with tests | classification seam must feed labels | #189/#52 | safe |
| Browser/package adapters | packaged app mount, Playwright health harness | all installed surfaces | #187 smoke and health tests | `/static` icon allowance; real selection/stack/media | #190/#66/#86/#94 | retain Playwright only here |

## Refactor fence

Safe decomposition can move React orchestration, adapters, and view composition
once the rows above continue to call the same authorities. It must not create a
second filesystem identity, association matcher, shortcut format, Trash policy,
classification table, or Windowing z-order authority.

Current blocking dependencies are #92 on the accepted #65 operation vocabulary,
#196 on the surviving #195 view seam, and packaged browser execution on the
currently missing local PocketIC session in this worktree. No unrelated new
Issue is opened by this audit.
