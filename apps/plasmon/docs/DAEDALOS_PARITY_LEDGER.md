# daedalOS parity and acceptance ledger

Status: canonical acceptance index  
Historical Plasmon evidence snapshot: `8ba35fbb265c6b86d483bd125165da03be7fc82c` (`version-0.1.0-os`, 2026-08-12)  
Current Plasmon integration target at metadata refresh: `release/0.1.0-r2` @ `aebb255bb0605f945258d581acab96d1f905b4b0` (2026-08-14)  
daedalOS reference snapshot: `DustinBrett/daedalOS@0df82d75e6114727ad035f6fce93842a96682355`

The current-r2 line records integration identity only. The evidence rows below remain grounded in the historical snapshot and subsequent evidence explicitly named in the ledger; this metadata refresh does not silently upgrade implementation, packaged/browser, or human/manual acceptance states.

This ledger records **evidence**, not roadmap priority. daedalOS is Plasmon's primary feature-completeness reference; Windows and macOS remain interaction/usability references. Matching a useful capability does not require copying daedalOS architecture or presentation.

GitHub Issues remain the engineering ledger. Rows below link existing Issues when work or acceptance remains; they do not replace Issue scope, dependencies, or discussion.

## Status rules

Each evidence dimension moves independently:

- **Implemented** — the capability exists in the current integration source. `Partial` means a meaningful subset exists but a referenced behavior is still absent.
- **Headless** — deterministic behavior is proven through production model/service/controller/composition tests. Source presence alone is not verification.
- **Packaged/browser** — the relevant installed-package or real-browser boundary has actually been exercised. Serving one asset does not prove an application's complete workflow.
- **Human/manual** — a dated human acceptance pass has explicitly accepted the visible behavior. Green CI does not imply this state.

Values are `Yes`, `Partial`, `No`, or `Unverified`. A failed or still-open manual baseline is stated explicitly rather than converted into `No` in another evidence column.

An open implementation PR does **not** advance this ledger until its behavior is present on the tracked integration snapshot. When integration advances materially, update the snapshot and only upgrade the evidence columns supported by the new source/tests/package/manual evidence.

## Acceptance summary

No broad user-visible area is marked fully human-accepted in this initial snapshot. The integrated follow-up manual/package gate is still tracked by [#107](https://github.com/plasmon-cloud/plasmon/issues/107), so this ledger deliberately does not turn merged source or green automated tests into final acceptance.

### Packaged/browser-proven but not yet human-accepted

- packaged Plasmon installation and real Kernel tile boot;
- native Recycle Bin launch/render;
- left/right native-window edge snapping through real pointer interaction;
- explicit `.jsdos` import/launch with package-local js-dos assets and a live canvas.

### Implemented/headless-proven but not yet fully package-proven

- canonical filesystem resource opening across FileManager/Start/Search;
- filesystem associations/default persistence;
- Trash/restore/permanent-delete semantics;
- managed `/System/Program Files` reconciliation;
- coherent taskbar presentation state;
- Text/Markdown document-session semantics;
- Shell preference persistence and most deterministic Shell/FileManager behavior.

### Concrete missing/partial reference behaviors already tracked

Examples include persisted window placement [#117](https://github.com/plasmon-cloud/plasmon/issues/117), FileManager Back history [#108](https://github.com/plasmon-cloud/plasmon/issues/108), Show Hidden Files [#110](https://github.com/plasmon-cloud/plasmon/issues/110), editor chrome/commands [#113](https://github.com/plasmon-cloud/plasmon/issues/113) / [#114](https://github.com/plasmon-cloud/plasmon/issues/114), EmulatorJS [#48](https://github.com/plasmon-cloud/plasmon/issues/48), durable js-dos progress [#64](https://github.com/plasmon-cloud/plasmon/issues/64), game artwork [#123](https://github.com/plasmon-cloud/plasmon/issues/123), and save-state screenshot thumbnails [#124](https://github.com/plasmon-cloud/plasmon/issues/124).

## Desktop, Shell, and Windowing

| Capability / reference | Plasmon intent / current disposition | Implemented | Headless | Packaged/browser | Human/manual | Evidence / remaining Issue |
| --- | --- | --- | --- | --- | --- | --- |
| Draggable/resizable native windows with minimize, maximize, close | Preserve normal desktop window grammar under Plasmon Windowing authority. | Yes | Yes | Partial | Unverified | `src/os/windowing/**`; packaged native-window use in `test/e2e/plasmon-golden-path.spec.ts`; integrated manual gate [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Left/right edge snapping | Windows-style extension to the reference window model; geometry remains below Shell. | Yes | Yes | Yes | Unverified | [#43](https://github.com/plasmon-cloud/plasmon/issues/43); packaged pointer proof in `test/e2e/plasmon-golden-path.spec.ts` |
| Persist size/position/normal placement across reopen | Match mature desktop placement behavior without weakening WindowManager geometry authority. | No | No | Unverified | Unverified | [#117](https://github.com/plasmon-cloud/plasmon/issues/117) |
| Filesystem-backed Start menu | Keep Start as a Plasmon filesystem projection rather than copying daedalOS process/catalog internals. | Yes | Yes | Partial | Unverified | `src/os/shell/startMenu.ts`; canonical activation [#32](https://github.com/plasmon-cloud/plasmon/issues/32); inventory polish [#87](https://github.com/plasmon-cloud/plasmon/issues/87), [#88](https://github.com/plasmon-cloud/plasmon/issues/88); manual gate [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Search across applications/filesystem resources | Preserve bounded search and canonical resource opening; do not copy implementation-oriented runtime tokens. | Partial | Yes | Partial | Unverified | `src/os/shell/search.ts`; opening [#32](https://github.com/plasmon-cloud/plasmon/issues/32); projection/presentation work [#49](https://github.com/plasmon-cloud/plasmon/issues/49), [#90](https://github.com/plasmon-cloud/plasmon/issues/90), [#91](https://github.com/plasmon-cloud/plasmon/issues/91) |
| Taskbar running/focus/launching presentation | Keep Process/Windowing/Neutron authoritative while Shell derives coherent user-facing pinned/running/active/launching/uncertain state. | Yes | Yes | Unverified | Unverified | [#72](https://github.com/plasmon-cloud/plasmon/issues/72); `src/os/shell/taskbarPresentation.test.ts`; visible taskbar acceptance remains [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Clock and calendar surface | Familiar desktop clock/calendar; no need to reproduce daedalOS worker/canvas implementation. | Yes | Yes | Partial | Unverified | `src/os/shell/calendar.ts`; taskbar clock is present in packaged Shell boot; full interaction remains in [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |

## Filesystem and FileManager

| Capability / reference | Plasmon intent / current disposition | Implemented | Headless | Packaged/browser | Human/manual | Evidence / remaining Issue |
| --- | --- | --- | --- | --- | --- | --- |
| Durable filesystem with stable identity | Use Plasmon FsService/NodeId rather than daedalOS BrowserFS/IndexedDB identity semantics. | Yes | Yes | Partial | Unverified | `src/os/fs/**`; shared production harness `test/headlessEnvironment.ts` |
| FileManager Back/Forward/Up/address navigation | Match familiar Explorer history while keeping stable filesystem identity. | Partial | Partial | Unverified | Failed prior baseline | Back-history defect is [#108](https://github.com/plasmon-cloud/plasmon/issues/108); recheck belongs to [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Thumbnail/details/resource presentation | Preserve useful previews and shared resource identity; avoid destructive crop and unsupported fake previews. | Partial | Partial | Unverified | Unverified | Image thumbnails exist; aspect-ratio gap [#93](https://github.com/plasmon-cloud/plasmon/issues/93), video thumbnails [#94](https://github.com/plasmon-cloud/plasmon/issues/94) |
| Internal/external drag/drop with truthful operation feedback | Keep filesystem move/import semantics canonical; UI owns progress/presentation. | Partial | Yes | Partial | Unverified | `src/os/file-manager/**`; progress/stacking gaps [#65](https://github.com/plasmon-cloud/plasmon/issues/65), [#66](https://github.com/plasmon-cloud/plasmon/issues/66), [#92](https://github.com/plasmon-cloud/plasmon/issues/92) |
| Open With, Properties, rename/copy/paste/delete style commands | Reuse canonical filesystem/association/resource policy rather than per-surface policy. | Yes | Yes | Partial | Unverified | `src/os/file-manager/**`; shared icon implementation [#47](https://github.com/plasmon-cloud/plasmon/issues/47); visible recheck [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Shortcuts with stable target identity | Prefer NodeId/Element identity instead of mutable path identity. | Partial | Yes | Unverified | Unverified | Canonical opening is integrated; user creation/convenience remains [#44](https://github.com/plasmon-cloud/plasmon/issues/44), [#51](https://github.com/plasmon-cloud/plasmon/issues/51) |
| Recoverable Delete / Recycle Bin | Implement through canonical TrashService; permanent delete is explicit. | Yes | Yes | Yes | Unverified | `test/fileManagerDelete.test.ts`; composed lifecycle coverage [#77](https://github.com/plasmon-cloud/plasmon/issues/77); packaged Recycle Bin in `test/e2e/plasmon-golden-path.spec.ts`; manual lifecycle [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Show hidden files | Filesystem owns dot-hidden classification; FileManager should expose a persisted presentation preference. | Partial | Yes | Unverified | Unverified | Hidden semantics exist; visible preference is [#110](https://github.com/plasmon-cloud/plasmon/issues/110) |
| Curated Program Files runtime surface | Keep `/System/Program Files` as managed runtime/resource exposure, not install authority. | Yes | Yes | Partial | Unverified | [#57](https://github.com/plasmon-cloud/plasmon/issues/57); js-dos package assets are browser-proven, general visible Program Files review remains [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |

## Applications, media, and editors

| Capability / reference | Plasmon intent / current disposition | Implemented | Headless | Packaged/browser | Human/manual | Evidence / remaining Issue |
| --- | --- | --- | --- | --- | --- | --- |
| Monaco text/code editing and filesystem save | Use real packaged Monaco while document persistence/conflict semantics stay below the browser. | Yes | Yes | Partial | Unverified | `src/native-apps/text/**`; packaged worker serving is proven by golden path, full edit/save/reopen is [#67](https://github.com/plasmon-cloud/plasmon/issues/67); editor polish [#113](https://github.com/plasmon-cloud/plasmon/issues/113) |
| Markdown edit + sanitized preview | Share Monaco/document semantics with Text; keep Markdown rendering app-owned. | Yes | Yes | Partial | Unverified | `src/native-apps/markdown/**`; full packaged edit/save/reopen [#67](https://github.com/plasmon-cloud/plasmon/issues/67); formatting/commands [#114](https://github.com/plasmon-cloud/plasmon/issues/114) |
| Photos viewer with navigation/fullscreen/zoom-oriented behavior | Native viewer should degrade cleanly when browser fullscreen/decode is unavailable. | Yes | Yes | Unverified | Unverified | `src/native-apps/photos/**`; packaged/manual recheck [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Video playback with truthful codec capability handling | Use browser media capability rather than pretending every recognized resource is decodable. | Yes | Yes | Unverified | Unverified | `src/native-apps/video/**`; packaged/manual codec behavior [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Browser address navigation and embedded/external web opening | Plasmon has the basic browser surface, but current integration lacks daedalOS-style Back/Forward/Reload history controls. | Partial | Yes | Unverified | Unverified | `src/native-apps/browser/Browser.tsx`; **Coordinator triage candidate: no canonical Issue found for Back/Forward/Reload** |
| Settings and durable Shell preferences | Persist Plasmon-owned settings through filesystem-backed state, not foreground localStorage. | Yes | Yes | Partial | Unverified | `src/native-apps/settings/**`, `src/os/shell/preferences.ts`; integrated manual gate [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |

## Games and runtimes

The detailed daedalOS runtime/source audit is maintained in [`GAMES_DAEDALOS_ARCHITECTURE.md`](GAMES_DAEDALOS_ARCHITECTURE.md). Direct visible game UX audit remains [#122](https://github.com/plasmon-cloud/plasmon/issues/122); this ledger does not claim that source-level runtime similarity proves visible parity.

| Capability / reference | Plasmon intent / current disposition | Implemented | Headless | Packaged/browser | Human/manual | Evidence / remaining Issue |
| --- | --- | --- | --- | --- | --- | --- |
| Association-driven `.jsdos` launch | Treat games as ordinary filesystem resources resolved through associations, not a game-title launcher. | Yes | Yes | Yes | Unverified | `src/native-apps/jsdos/**`; `test/e2e/plasmon-games-proof.spec.ts`; reusable explicit fixture path [#121](https://github.com/plasmon-cloud/plasmon/issues/121) |
| js-dos progress survives close/reopen | Persist authoritative progress through Plasmon filesystem state tied to stable game identity. | No | No | No | Unverified | [#64](https://github.com/plasmon-cloud/plasmon/issues/64) |
| EmulatorJS ROM runtime | Add a second association-driven runtime only; no `.sys` facade or game-title dispatch. | No | No | No | Unverified | [#48](https://github.com/plasmon-cloud/plasmon/issues/48); open PR work does not count until integrated |
| Game artwork thumbnails | Use shared resource presentation with stable metadata and deterministic fallback. | No | No | No | Unverified | [#123](https://github.com/plasmon-cloud/plasmon/issues/123); direct reference audit [#122](https://github.com/plasmon-cloud/plasmon/issues/122) |
| Save/snapshot screenshot thumbnails | Keep screenshot presentation subordinate to authoritative save bytes. | No | No | No | Unverified | [#124](https://github.com/plasmon-cloud/plasmon/issues/124); direct reference audit [#122](https://github.com/plasmon-cloud/plasmon/issues/122) |

## Neutron/package integration and persistence

| Capability / reference | Plasmon intent / current disposition | Implemented | Headless | Packaged/browser | Human/manual | Evidence / remaining Issue |
| --- | --- | --- | --- | --- | --- | --- |
| Plasmon installs/boots as a real Neutron application | Neutron remains Kernel/runtime authority; Plasmon is one normal packaged application. | Yes | Yes | Yes | Unverified | [#33](https://github.com/plasmon-cloud/plasmon/issues/33); `test/e2e/plasmon-golden-path.spec.ts` |
| Installed Neutron Elements appear as filesystem/application projections and launch through Neutron | `/Apps/*.neutron` remains a projection only; no shadow install/runtime database. | Yes | Yes | Partial | Unverified | `src/os/neutron/**`, `src/os/fs/**`; authority audit [#120](https://github.com/plasmon-cloud/plasmon/issues/120); visible `.neutron` activation recheck [#107](https://github.com/plasmon-cloud/plasmon/issues/107) |
| Uninstall installed Neutron application from Plasmon | Do not fake uninstall by deleting the projection; ordinary Plasmon app-facing uninstall is unavailable until Neutron exposes an accepted capability. | No | Yes | Unverified | Unverified | capability audit [#46](https://github.com/plasmon-cloud/plasmon/issues/46); this is an upstream boundary, not permission to invent a local substitute |
| Association defaults persist durably | Use FsService-backed metadata as the sole supported durable authority. | Yes | Yes | Unverified | Unverified | `src/os/associations/**`; composed regression `test/associationOpenComposition.test.ts`; [#53](https://github.com/plasmon-cloud/plasmon/issues/53) |

## Accessibility and interaction follow-through

Accessibility/interaction acceptance is intentionally not inferred from model tests. Two concrete visible gaps already tracked are selectable diagnostic text [#86](https://github.com/plasmon-cloud/plasmon/issues/86) and replacing the platform emoji pin affordance with shared icon presentation [#109](https://github.com/plasmon-cloud/plasmon/issues/109). Broader keyboard/pointer/visual acceptance belongs to the integrated manual gate [#107](https://github.com/plasmon-cloud/plasmon/issues/107) unless a distinct defect has its own Issue.

## Reference evidence

The current upstream daedalOS `main` is the same commit already inspected by the Games architecture audit: `0df82d75e6114727ad035f6fce93842a96682355`.

For the seeded capability set, the daedalOS repository directly documents/implements File Explorer navigation and operations, draggable/resizable/persistent windows, Start/taskbar/clock, Browser navigation, Monaco status/formatting, Photos fullscreen/zoom, js-dos autosave, and EmulatorJS ROM handling. The Games architecture document records the deeper source paths and runtime/save behavior already inspected for those runtimes.

This ledger should grow only when a concrete reference behavior is actually inspected or a current Plasmon capability needs an acceptance state. It should not become an exhaustive copy of the daedalOS README or a speculative backlog.