# Native-app recomposition/restart matrix

| surface | must survive same repository | must not survive | evidence |
|---|---|---|---|
| Text/Markdown | resource bytes, NodeId, settings if accepted | Monaco instance/focus/timer | FS/session tests; #179 |
| Photos/Video | resource bytes/metadata | Blob URL, media element, zoom transient | FS/media helpers |
| Browser | `.url` resource/content | iframe/document state unless explicit | URL tests |
| Settings | Fs-backed preferences and metadata | loading summary | Shell/settings tests |
| Explorer/Properties | FS nodes/identity and metadata | navigation UI transient | FS/navigation tests |
| Recycle Bin | Trash entries/NodeId | selection/loading | Trash/model tests |
| js-dos | future #64 save artifact | player/Blob/canvas | #64 packet |
| EmulatorJS | ROM/resource only; no save claim for NES fixture | iframe/WASM/audio | README/package |
| Review | Atom/current/history/provider persistence | UI focus/loading | Review persistence/e2e |

Two independent Plasmon compositions can share MemoryFsRepository in the headless
harness; this proves deterministic filesystem recomposition, not browser Worker
or runtime restart.
