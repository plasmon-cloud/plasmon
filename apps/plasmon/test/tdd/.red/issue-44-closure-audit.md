# Issue #44 closure audit

Date: 2026-08-13. Integrated source inspected: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
No active implementation PR owns #44. This is a closure audit, not a new RED.

## Criterion evidence

| Canonical criterion | Authority | Permanent evidence | Result |
|---|---|---|---|
| FileManager exposes Create Shortcut for eligible selected resources | FileManager command seam + `createFileManagerShortcut` | `apps/plasmon/src/os/file-manager/create-shortcut.test.tsx` command/selection/collision coverage and `FileManager.tsx` command entry points | PROVEN in integrated source; UI packaged discoverability remains not separately packaged-tested |
| stable NodeId target | FsService `createShortcut`, shared shortcut metadata | `apps/plasmon/test/refactorGuards.test.ts` stable NodeId lifecycle; `apps/plasmon/test/resourceOpenCrossSurface.test.ts`; `src/os/fs/desktopCore.test.ts` | PROVEN |
| canonical serialization / no second format | `src/os/fs/shortcut.ts` `shortcutMetadata` / `parseSharedShortcut` | `src/os/fs/desktopCore.test.ts`, `src/os/fs/defaultSeeds.test.ts`, refactor guards | PROVEN |
| collision-safe name | `uniqueChildName` | `apps/plasmon/src/os/file-manager/create-shortcut.test.tsx` proves report.txt (1)/(2) collision behavior; `src/os/fs/shortcut.ts` source confirms lower-case collision semantics | PROVEN if focused shortcut collision test is retained in permanent suite; confirm path in D ledger |
| target survives path rename/move | NodeId target + FsService | `test/refactorGuards.test.ts` renames/moves resource before shortcut activation | PROVEN |
| dereference/open | `FilesystemOpenDispatcher` | `test/resourceOpenCrossSurface.test.ts`, `test/fileManagerActivation.test.ts`, `src/os/fs/desktopCore.test.ts` | PROVEN |
| missing target behavior | open dispatcher NodeId stat/error path | `src/os/fs/desktopCore.test.ts` covers Trash target rejection; `test/fileManagerActivation.test.ts` covers canonical activation failures | PROVEN for safe failure; exact FileManager-visible message is activation-owned |
| no partial state on creation failure | not a canonical #44 acceptance criterion; filesystem atomicity remains owned by FsService | no separate #44 gate required | OUT OF SCOPE FOR #44 |
| normal selection/rename after creation | FileManager helper returns shortcut and selects/renames it | `apps/plasmon/src/os/file-manager/create-shortcut.test.tsx` creation/selection/rename characterization and FileManager implementation | CORE GREEN; packaged visual interaction not independently proven |
| FileManager does not own execution/serialization authority | FsService shortcut primitive + dispatcher | `test/refactorGuards.test.ts`, `test/resourceOpenCrossSurface.test.ts`, refactor guards | PROVEN |

## Disposition

**ALREADY GREEN — COMPLETE CANONICAL ACCEPTANCE PROVEN** on integrated release.
Packaged/manual discoverability is explicitly optional in the Issue verification
text and is not a missing acceptance criterion. Do not manufacture a RED or
promote a test-local failure-atomicity requirement.

The permanent GREEN destination is the existing headless suite, especially:

- `apps/plasmon/src/os/fs/desktopCore.test.ts`;
- `apps/plasmon/test/refactorGuards.test.ts`;
- `apps/plasmon/test/resourceOpenCrossSurface.test.ts`;
- `apps/plasmon/test/fileManagerActivation.test.ts`;
- `apps/plasmon/src/os/file-manager/create-shortcut.test.tsx`.

The FileManager must continue to call the shared primitive, not copy its naming
or metadata policy. Any future FsService atomicity work belongs to the
filesystem authority and must not be attributed to #44.
