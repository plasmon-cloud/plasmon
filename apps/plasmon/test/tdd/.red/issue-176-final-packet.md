# Luna A RED Packet — Issue #176

Canonical Issue: **Prevent browser context menus from leaking through
Plasmon-owned UI**

Target release: `release/0.1.0-r2`

Integrated source inspected for current promotion audit:
`origin/release/0.1.0-r2` at
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`.

Original RED reproduction was against `120be60eda48ada462ba9bebeaab524aaf9afde7`.
PR #235 (`agent/issue-176-context-menu-boundary`) is now open and owns
implementation; Sol 1 has adopted this packet and must not be duplicated or
modified here.
This packet contains no production implementation. The existing Luna-B
acceptance map/browser-adoption notes were consumed; the canonical RED test is
now staged here without adding a second policy or command authority.

## Authority protected

- `Shell.tsx::onShellContextMenu` and `resolveShellContextMenuPolicy()` own
  Shell-level arbitration and specialized native/Element task menus.
- `FileManager.tsx`/`FileManagerEntries.tsx` and `FileManagerContextMenu.tsx`
  own filesystem resource selection and specialized context commands.
- First-party native-app roots and `NativeWindow` chrome remain owned by their
  app/window adapters.
- Browser, foreign, embedded Neutron iframe, FsService, Open/Association,
  Process/Windowing, Visual, and command authorities remain external boundaries.

## PRESERVE

- Specialized Shell/taskbar, FileManager/sidebar/resource, and native-app
  context menus and canonical commands.
- Editable controls' intentional browser/editor text behavior, including rename
  inputs, text editors, address fields, and contenteditable regions.
- Browser-app, foreign, and embedded Neutron content where Plasmon is not the
  browser-event authority.
- Deterministic `contextmenu` propagation, `defaultPrevented` state, accessible
  ownership, focus, Escape dismissal, and specialized-menu precedence.

## CHANGE

Current first-party ownership is inconsistent:

- Shell claims owned non-editable surfaces through specialized/generic policy.
- FileManager's outer context handler unconditionally prevents the event,
  including when the target is its inline rename editor.
- First-party native-app roots do not yet have one characterized reusable
  ownership boundary.

Issue #176 must establish one small reusable first-party event/context-menu
ownership seam. Specialized subsystems retain command/menu authority. The seam
must suppress browser-native menus only for Plasmon-owned non-editable surfaces,
while allowing editable and foreign boundaries to remain unclaimed. A fallback
menu may expose only accepted canonical commands.

## UNSPECIFIED

- seam/module name and exact adapter placement;
- fallback menu contents, styling, placement, and command vocabulary;
- native-app root markers and migration order;
- whether specialized menus remain app-local or are composed by Shell/FileManager;
- exact browser-default-menu observation mechanism.

Do not add a global unconditional `preventDefault()`, a capture listener that
intercepts foreign content, a parallel Surface/event framework, a second
command authority, or source-shape tests.

## Existing guards

Executed against current r2:

```text
bun test apps/plasmon/src/os/shell/gate3.test.ts \
  apps/plasmon/src/os/file-manager/file-manager.test.ts
```

Result: **27 passed, 0 failed, 90 expects**.

These guards cover Shell policy precedence (`none`, `generic`, `native-task`,
`element-task`), flyout dismissal, FileManager selection/rename/clipboard/drop
semantics, and canonical commands. They do not prove complete browser context
ownership across all first-party and foreign surfaces.

## New characterization guards

`apps/plasmon/test/tdd/.red/issue-176.red.ui.test.tsx` contains two semantic
RTL guards using the canonical `renderPlasmon()` production graph:

1. editable FileManager rename input remains an intentional browser/editor
   boundary;
2. Shell-owned taskbar context is claimed while an appended foreign iframe
   element remains unclaimed.

No fake command list, global event service, or test-local production policy is
introduced. Real iframe-document and browser-default behavior remains a
Playwright boundary.

## Intentional RED

The first guard must fail against current r2:

```text
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/tdd/.red/issue-176.red.ui.test.tsx
```

Original characterization result against `120be60`: **1 intentional RED,
1 passing characterization, 5 expects**. Current r2 promotion is pending PR
#235; its permanent regression paths are tracked in the open PR.

Failure:

```text
FileManager inline rename editing retains intentional context-menu text behavior
Expected event.defaultPrevented: false
Received: true
```

This is the intended missing editable-boundary behavior, not setup absence or a
swallowed error. The passing test proves Shell-owned prevention and foreign
child non-interception.

## Test layers

- **Bun/headless:** existing Shell/FileManager deterministic policy and command
  guards; no new lower-layer policy is invented.
- **RTL:** the new semantic event/propagation gate above is the lowest truthful
  RED layer for editable and owned/foreign DOM boundaries.
- **Playwright:** required for real right-click/default-menu behavior,
  pointer hit-testing, first-party native-app roots, sidebar/background roots,
  iframe-document ownership, and browser propagation. Reuse the packaged
  launcher and strict health baseline; do not create a context-menu harness.
- **Manual/accessibility:** fallback discoverability and focus/menu UX remain
  review claims unless promoted to stable semantic tests.

## Harness gaps

**None.** RTL expresses the current semantic boundary. The packaged browser
boundary is executable through the existing harness in principle. Missing
`local.ndeploy.session.json` is an operational browser-session block, not a
HARNESS GAP and not a product RED.

## Final packet path/commit

- Packet: `apps/plasmon/test/tdd/.red/issue-176-final-packet.md`
- RED gate: `apps/plasmon/test/tdd/.red/issue-176.red.ui.test.tsx`
- Luna-A staging commit: `7a69d9b7ba810ffc00aa2ccc8907f1e60db454ef`.
- Promotion owner: PR #235; do not modify the active implementation branch.
