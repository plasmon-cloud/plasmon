# Luna RED Packet — Issue #176

**Current r2 refresh / canonical gate adoption**

Integrated source inspected: `origin/release/0.1.0-r2` at
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`.

Active ownership check: no open PR owns #176. Sol 1 is expected to consume the
packet later. The existing Luna-B packet and gate are the canonical first
characterization source; the gate semantics were adopted into the current
canonical staging packet without adding a second policy or command authority:

- `apps/plasmon/test/tdd/.red/issue-176.red.ui.test.tsx`
- `apps/plasmon/test/tdd/issue-176-acceptance-map.md`
- `apps/plasmon/test/tdd/issue-176-browser-adoption.md`

This Luna-A refresh records current-head evidence and authority boundaries only.
No production implementation was made.

## Authority protected

- `Shell.tsx::onShellContextMenu` and
  `resolveShellContextMenuPolicy()` own Shell-level context-menu arbitration;
  specialized native/Element task menus outrank the generic Shell menu.
- `FileManager.tsx` and `FileManagerEntries.tsx` own filesystem resource
  selection/context commands; `FileManagerContextMenu` owns its specialized
  command menu.
- First-party native application roots and outer `NativeWindow` chrome remain
  owned by their application/window adapters.
- Browser/foreign/embedded iframe content remains outside Plasmon browser-event
  authority.
- Existing `FsService`, association/open, Process/Windowing, Visual, and
  command authorities remain unchanged.

## PRESERVE

- Specialized Shell/taskbar, FileManager/sidebar/resource, and native-app
  context menus and their canonical commands.
- Editable controls' intentional text context behavior, including rename inputs,
  text editors, address fields, and contenteditable regions.
- Browser app, foreign authenticated content, and embedded Neutron/iframe
  content where Plasmon is not the browser-event authority.
- Deterministic `contextmenu` propagation, `defaultPrevented` state, accessible
  menu ownership, focus, Escape dismissal, and specialized-menu precedence.
- One shared first-party event-ownership seam consumable by #195/#197/#198/#199
  and #112; no subsystem may create a competing global policy.

## CHANGE

The current release still has inconsistent first-party ownership:

- Shell claims owned non-editable surfaces through its specialized/generic
  policy.
- FileManager's outer `onContextMenu` unconditionally calls `preventDefault()`;
  this leaks ownership into its inline rename editor and prevents intentional
  editable text behavior.
- Native-app chrome/content roots do not yet have one characterized shared
  first-party boundary; their app-local `preventDefault()` calls remain
  specialized behavior and must not be replaced by a global hack.

Issue #176 must establish one small browser/event ownership seam that suppresses
browser-native menus only for Plasmon-owned, non-editable surfaces, while
allowing specialized menus to claim their commands and allowing foreign/editor
boundaries to remain unclaimed. A fallback may exist only where an accepted
canonical command vocabulary exists; no fake actions are authorized.

## UNSPECIFIED

- seam/module name and whether it is a pure hit/policy function plus thin React
  adapters or another equivalent small composition;
- exact fallback menu contents, placement, styling, and command availability;
- exact native-app root markers and migration order;
- whether a specialized menu is rendered by Shell, FileManager, or an app-local
  adapter, provided ownership and propagation remain deterministic;
- browser-default menu observability mechanism in Playwright.

Do not introduce a global unconditional `preventDefault()`, a capture listener
that intercepts foreign/embedded content, `Surface2`/parallel event framework,
second command authorities, or source-shape tests.

## Existing guards

Original characterization executed against r2 `120be60` before PR #235:

```text
bun test apps/plasmon/src/os/shell/gate3.test.ts \
  apps/plasmon/src/os/file-manager/file-manager.test.ts
```

Result: **27 passed, 0 failed, 90 expects**.

These guards cover Shell policy precedence (`none`, generic, native-task,
element-task), flyout dismissal, FileManager selection/rename/clipboard/drop
semantics, and canonical command behavior. They do not prove browser-default
context-menu suppression across every surface.

Additional existing authority evidence:

- `FileManagerContextMenu.tsx` prevents the specialized menu's own browser
  context menu and delegates actions through FileManager commands.
- `Shell.tsx` claims non-editable Shell-owned surfaces and leaves inputs,
  textareas, and contenteditable targets unclaimed.
- `test/e2e/plasmon-refactor-smoke.spec.ts` exercises the accessible Shell
  context menu, but does not prove foreign iframe or browser-default behavior.

## New characterization guards

The canonical characterization gate is now staged in this lane as:

```text
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/tdd/.red/issue-176.red.ui.test.tsx
```

Against current r2, result: **1 intentional RED, 1 passing characterization,
5 expects**.

- Passing characterization: Shell-owned taskbar context is prevented and the
  appended foreign iframe remains unclaimed.
- The existing gate is the permanent semantic destination; do not create a
  second Luna-A copy.

## New intentional RED

The canonical existing gate fails for the intended missing behavior:

```text
FileManager inline rename editing retains intentional context-menu text behavior
Expected event.defaultPrevented: false
Received: true
```

The failure is caused by the FileManager-owned outer/entry context-menu
handling, not by setup absence or swallowed errors. It is an RTL/event boundary
RED. It does not claim that the browser's native menu itself was observed.

## Test layers

- **Bun/headless:** existing Shell policy and FileManager command/selection
  guards; no new deterministic policy is invented in this refresh.
- **RTL:** canonical `issue-176.red.ui.test.tsx` proves event cancellation and
  foreign-child non-interception; editable control is the intentional RED.
- **Playwright:** required for real right-click/default-menu propagation,
  pointer hit-testing, first-party native-app roots, FileManager/sidebar roots,
  and iframe/foreign ownership. Reuse the packaged launcher and strict health
  baseline; do not add a context-menu harness.
- **Manual/accessibility:** fallback discoverability and focus/menu UX remain
  review claims unless promoted to stable semantic tests.

## HARNESS GAP

**None.** RTL expresses the current editable/owned/foreign event boundary. The
packaged browser boundary is executable in principle through the existing
harness; its current non-execution is an operational session block, not a
harness gap or product RED.

## Browser boundary status

`local.ndeploy.session.json` is absent in this worktree, so packaged browser
execution is not claimed. The required adoption destination remains
`issue-176-browser-adoption.md`; browser `--list` or parser output would not
count as execution.

## Final packet commit/path

This refresh packet is committed at:

```text
apps/plasmon/test/tdd/.red/issue-176-luna-a-refresh.md
```

The Luna-B browser adoption packet remains the reference for packaged
propagation work; this lane owns only the current canonical RTL RED staging
artifact and does not modify Luna-B's branch.
