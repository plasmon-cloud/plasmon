# #176 context-menu ownership RED / guard packet

**Status: FINAL IMPLEMENTOR PACKET READY — RTL RED plus browser adoption boundary**

Current r2 implementation was inspected at `origin/release/0.1.0-r2` (`4024add`). The smallest truthful deterministic RED is the editable FileManager rename boundary; current FileManager outer/entry handlers call `preventDefault()` for the rename input. The packet does not invent fallback commands or a global context-menu service.

## Authority and dispositions

| surface / event | authority | disposition | guard |
|---|---|---|---|
| Shell-owned taskbar/flyout/context surface | Shell interaction policy and specialized Shell menus | **PRESERVE** ownership and `preventDefault`; specialized task policy wins | `resolveShellContextMenuPolicy` tests and packet RTL |
| FileManager resource/sidebar/entry menus | FileManager capability-aware context commands | **PRESERVE** specialized menu; **CHANGE** editable target exception | packet RED: rename editor must not be indiscriminately claimed |
| first-party native-app chrome/content | owning native app and outer Windowing adapter | **CHANGE** each owned root to the shared boundary; preserve app commands | packaged/browser adoption; no fake command list |
| Browser/foreign/embedded content | browser/foreign owner | **PRESERVE** native/foreign behavior; Shell must not intercept | packet RTL foreign-child characterization plus browser adoption |
| editable controls | control/editor owner | **PRESERVE** intentional text operations; no generic FileManager/Shell interception | packet RED |
| unsupported owned area | Shell/FileManager fallback only if an accepted command vocabulary exists | **UNSPECIFIED** until command authority is named | do not invent actions |

## Executable packet

```sh
npm --workspace neutron-plasmon run test:ui -- --filter issue-176
```

or directly:

```sh
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/tdd/.red/issue-176.red.ui.test.tsx
```

Current result: **1 RED, 1 passing characterization**.

- RED: FileManager inline rename input receives a prevented `contextmenu`; expected editable boundary remains unclaimed.
- Pass: Shell-owned taskbar context is claimed while an appended foreign iframe element remains unclaimed. The current release names this specialized surface `Taskbar context menu`.

Existing specialized policy tests remain authoritative for `none`, `generic`, `native-task`, and `element-task` precedence. Existing FileManager tests cover capability-aware specialized actions. Do not duplicate those command semantics in this packet.

## Browser adoption

`issue-176-browser-adoption.md` defines the packaged event-propagation check for taskbar/Shell-owned, FileManager, first-party native-app, editable, and embedded/foreign boundaries. It must use the existing packaged environment and strict #187 browser-health listener. No Playwright claim is made until executed.

## Permanent destination

Adopt the editable-target exception into the owning FileManager/context policy test and retain the semantic RTL boundary test. Keep browser propagation/embedded content in the existing packaged refactor smoke or a minimal #176 Playwright spec. Do not create a global `preventDefault()` hack, a second Shell/FileManager menu authority, or fake commands.
