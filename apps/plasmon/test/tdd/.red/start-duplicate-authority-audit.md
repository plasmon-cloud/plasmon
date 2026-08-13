# Start stale/duplicate-authority audit

Status: **RECONNAISSANCE**. No production code is changed. `#169` remains an
active dependency owned by today's queue; do not consume an unmerged design.

| Candidate | Location | Current role | Classification | Safe now? | Reason |
|---|---|---|---|---|---|
| `START_MENU_PATH` | `os/shell/startMenu.ts` | durable path | canonical | no | FsService authority |
| `reconcileStartMenu` | `startMenu.ts` | default seed/migration | canonical but #169-owned | wait #169 | preserves user customization and ledger |
| `startTrail/startItems` | `Shell.tsx` | React read/navigation state | derived cache | no | future #194 surface state, not durable inventory |
| `deriveStartEntries` | `shell/model.ts` | registry-based Start model | suspicious duplicate | unknown | no current Shell JSX consumer found; retain until static/dynamic consumer audit |
| `nativeDefinitions` | `Shell.tsx` | reconciliation input/taskbar/Search | canonical registry snapshot | no | not Start catalog |
| `elements` | `Shell.tsx` | runtime snapshot/reconciliation | canonical external snapshot | no | not durable Start inventory |
| `START_SEEDED_IDENTITIES_KEY` | `startMenu.ts` | migration ledger | canonical durable metadata | no | deletion/customization safety |
| `shortcutPresentation` | `Shell.tsx` | icon/pin display | presentation-only | no | move to shared Visual only with #190 contract |
| `parseStartShortcut` | `startMenu.ts` | shortcut metadata parsing | canonical parser | no | shared shortcut format |
| `searchApplicationEntries` | `search.ts` | Search app projection | separate Search authority | no | #193/#174, not Start |
| `StartShortcutSearchResult` | `search.ts` | Search projection | derived | no | ordinary FS traversal |
| `StartPanel`/start arrays in `gui2/DesktopShell2.tsx` | legacy gui2 | separate legacy desktop | obsolete candidate, not proven dead | no | #25/#26 and runtime entry audit required |
| hard-coded `System` list | `startMenu.ts` retired constants | migration detector | compatibility policy | no | released-data migration safety |
| `RETIRED_SYSTEM_NATIVE_HANDLERS` | `startMenu.ts` | exact migration scope | canonical migration detail | no | do not broaden from names |
| start item icon fallback strings | `Shell.tsx` | visual fallback | presentation | no | #190/shared Visual boundary |

## Search method and result

Searched `os/shell`, Shell entrypoints, `gui2`, and Start-related tests for
literal Start inventories, native app lists, shortcut metadata, and launch
branches. The only clearly canonical durable inventory is the FsService tree.
The `deriveStartEntries` model is the primary suspicious duplicate but its
consumer status and legacy compatibility role must be proven before retirement.
