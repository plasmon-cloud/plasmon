# Start authority map

Refresh: integrated release `f4ac3b4`. #169 is today's unattended implementation
ownership; this map does not edit or prescribe its reconciliation algorithm.
#194 has no active PR and is future work.

| Concern | Actual authority | Current consumer | Classification |
|---|---|---|---|
| durable root | FsService path `/System/Start Menu` | `ensureStartRoot`, Shell navigation | canonical |
| managed defaults | `reconcileStartMenu` in `startMenu.ts` | Shell reconciliation effect; deterministic tests | canonical controller candidate; final #169 boundary |
| seed ledger | root metadata `plasmon.shell.start.seeded.v1` | reconciliation | canonical durable migration evidence |
| target identity | parsed shared shortcut target / `startShortcutTargetIdentity` | scan/reconcile/Search/activation | canonical |
| root listing | `listStartMenuFolder(fs, root.id)` | Shell `startItems` | derived read |
| subfolder listing | same FsService function by NodeId | Shell trail/list effect | derived read |
| filesystem refresh | `FsEventSource` -> Shell `fsEpoch` | reload current folder | canonical event source, Shell adapter |
| activation | `activateStartFilesystemNode` -> `FilesystemOpenDispatcher` | Shell click callback | canonical opening authority |
| native definitions | `NativeAppRegistry.list()` | reconciliation seed input, Search/taskbar | canonical registry input; not durable Start inventory |
| Element definitions | Neutron bridge `loadElements` | reconciliation seed input, presentation | external canonical runtime input |
| keyboard focus | DOM autoFocus + `focusRelative` | Start input/list | browser adapter; accepted semantics need characterization |
| flyout/dismissal | Shell `flyout`, document/window listeners | Start open/close | Shell-global transient coordination |
| user rename/move/delete | FsService mutations | reconciliation scan/preserve semantics | canonical user data; never overwritten absent proof |
| upgrade retirement | conservative functions in `startMenu.ts` | reconciliation | canonical migration policy; #169 owns changes |
| presentation | `shortcutPresentation`, ShellIcon, PinIcon, eventual Visual | Shell JSX | presentation-only |

## Start-like arrays/catalogs found

- `nativeDefinitions` is a registry snapshot, not a Start inventory.
- `elements`/`elementsById` is a Neutron runtime snapshot, not durable Start.
- `startTrail` is transient navigation path.
- `startItems` is a transient listing cache.
- `filteredStartItems` is a derived display filter.
- `START_SEEDED_IDENTITIES_KEY` is durable reconciliation ledger, not an app
  catalog.
- `deriveStartEntries` in `shell/model.ts` is a separate legacy/vanilla model
  over registry snapshots and is not used by the filesystem-backed Start JSX in
  current Shell. It is suspicious duplicate authority and must not be silently
  reintroduced or deleted before consumer audit.
- Search's `StartShortcutSearchResult` is a projection of ordinary filesystem
  shortcuts, not Start inventory authority.

No production array may become the replacement for `/System/Start Menu`.
