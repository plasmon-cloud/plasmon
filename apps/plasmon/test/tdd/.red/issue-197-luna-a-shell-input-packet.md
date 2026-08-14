# Issue #197 — Luna-A FileManager/Filesystem input packet

Disposition: **BLOCKED — Shell decomposition implementation belongs to Luna-B**;
this is a bounded consumer/authority handoff, not a competing Shell packet.

Integrated release: `4024addc4902cd019b64df548e4fb2dbf84cd053`. No active #197 PR observed; #193/#169 implementation PRs are separate active ownership and must not be modified.

## PRESERVE

- FileManager remains the consumer of canonical filesystem listing, selection,
  activation, shortcut, Trash, clipboard, classification, presentation, and
  operation results.
- Search consumes `searchShell` results and canonical activation; Start consumes
  `/System/Start Menu` and #169 reconciliation; neither Shell snapshot is a
  durable catalog.
- Process/Windowing, FsService, Association/OpenService, Neutron, Trash,
  #189/#190 Visual, and #192 placement remain outside Shell.
- #176 first-party context ownership and browser-global dismissal boundaries
  must remain explicit; no Shell-global event interceptor may absorb FileManager
  or foreign content behavior.

## CHANGE input for Luna-B

Shell may become a composition root over focused Search/Start/taskbar/tray/
calendar/settings/context surfaces and a transient flyout controller. The
FileManager-facing contract is a rendered child/workspace plus canonical
callbacks/snapshots, not a Shell-owned filesystem or running-app database.
Move deterministic Shell policy to pure models/controllers and keep DOM event
translation in humble adapters. #193/#194 should supply focused Search/Start
surfaces; #198 owns taskbar projection; #176 owns context/event ownership.

## UNSPECIFIED

Shell component names, controller count, snapshot transport, transient state
shape, CSS, effect placement, and migration order. No Shell2, duplicate Search/
Start inventory, or FileManager command authority.

## Exact A-owned guards to consume

- `test/resourceOpenCrossSurface.test.ts` and `test/fileManagerActivation.test.ts`
  for FileManager/Search/Start canonical opening.
- `test/refactorGuards.test.ts` for assembled FsService/NodeId/Process/Windowing/
  projection identity.
- `src/os/file-manager/create-shortcut.test.tsx` and `send-to-desktop.test.ts`
  for canonical shortcut consumers.
- `test/fileManagerDelete.test.ts` and `test/trashLifecycle.test.ts` for Trash.
- `src/os/file-manager/operation-state.test.ts` and #65 RTL packet for accepted
  import/paste operation state; #92 remains separate drag RED.
- `test/refactor/189/issue-189.test.ts`, #190 Visual tests, #191 FileEntry guards,
  #192 layout tests, and integrated #173 spatial/list guards.

## Browser boundary / HARNESS GAP

Browser-only Shell claims (click-away, focus return, menu anchoring, hit testing,
foreign iframe/content, and geometry) remain Luna-B/#176/#187 boundaries. No
Luna-A harness gap is identified. Do not simulate document capture or foreign
content in headless policy tests.

## Likely / forbidden areas

Luna-B likely modifies Shell composition/controllers and Shell tests/docs.
Luna-A consumer files may be touched only when an owned implementation explicitly
requires a FileManager adapter contract. Do not modify FsService, Search/Start
authority, Trash, Process/Windowing, Visual, or another Luna's active packet.
