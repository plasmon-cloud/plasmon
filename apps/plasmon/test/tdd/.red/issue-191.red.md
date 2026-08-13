# Issue #191 RED packet — Desktop FileEntry

This packet is staging-only. It consumes the merged #187 shared headless/RTL and packaged browser-health infrastructure; it does not add a second harness.

## Existing guards

- `src/os/file-manager/file-manager.test.ts`: NodeId-keyed selection/range/select-all, rename commit/cancel policy, and NodeId-keyed Desktop placement.
- `src/os/file-manager/polish.test.tsx`: F2 mapping, Enter/Escape rename mapping, image thumbnail loading/revocation.
- `src/os/file-manager/polish-component-regression.test.ts`: rename-session selection, Enter/Escape blur suppression, association pass-through into `FileEntry`.
- `src/os/file-manager/desktop-label.test.tsx`: selected/focused overlay and rename replacing the expanded label.
- `src/os/file-manager/file-icons.test.ts`: shared resource presentation, application/system artwork, shortcut target composition, deterministic fallback.
- `src/os/file-manager/gate3.test.tsx`: shortcut NodeId preservation through rename/move and browser context-menu ownership source guard.
- `src/os/fs/fs.test.ts`, `desktopCore.test.ts`: stable identity through rename/move and canonical open/shortcut dispatch.
- `test/refactorGuards.test.ts`, `test/fileManagerActivation.test.ts`, `test/resourceOpenCrossSurface.test.ts`: composed canonical opening, shortcut activation, identity lifecycle, and cross-surface authority.
- `test/rtl/renderPlasmon.test.tsx`: real RTL click/rename/Enter/context-menu/Properties/directory activation/taskbar adapter path.
- `test/e2e/plasmon-refactor-smoke.spec.ts`: merged #187 packaged smoke, browser health, Desktop rename reachability, and gross bounds.

## Classification

### PRESERVE

- Selection and focus remain keyed by `NodeId`.
- Rename commits/cancels through `FsService`; Enter commits and Escape cancels.
- Rename does not replace identity.
- Double-click activation delegates to canonical filesystem/open dispatch.
- Context commands remain Plasmon-owned and do not expose the browser context menu.
- Shortcut presentation preserves target artwork and execution remains canonical shortcut/open dispatch.
- Image thumbnails remain filesystem-backed and revoke object URLs.
- Existing accessibility roles/names and accepted keyboard behavior remain usable.

### CHANGE

- Desktop rename editor/label must be bounded by the FileEntry/tile presentation, not the current expanded 260px label surface.
- Long selected/renaming labels must not change unrelated neighboring entry placement.
- FileEntry reconstruction must continue consuming resolved shared presentation/shortcut composition rather than creating another semantic icon/type/open authority.

### UNSPECIFIED

- Exact pixel dimensions, typography, palette, wrapping policy, and screenshot baselines are not frozen by current accepted evidence.
- No new screenshot baseline is staged: #187's visual spike proved determinism but explicitly retired the temporary snapshots and says visual baselines are not an r2 gate.
- List/details presentation redesign and broad FileManager decomposition remain separately owned.

## Files

- `issue-191.red.test.ts`: Bun static characterization of NodeId-backed selected/focused/rename rendering.
- `issue-191.red.ui.test.tsx`: explicit RTL adapter characterization for Escape cancellation; run with the canonical Happy DOM preload.
- `../../../../../test/e2e/plasmon-file-entry-191.red.spec.ts`: explicit packaged Playwright geometry RED using #187's `installPlasmonBrowserHealth`.

## Commands

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-191.red.test.ts
bun test --preload ./apps/plasmon/test/setupHappyDom.ts ./apps/plasmon/test/tdd/.red/issue-191.red.ui.test.tsx
npx playwright test test/e2e/plasmon-file-entry-191.red.spec.ts
```

The two Bun characterization commands are expected to pass. The Playwright command is intentionally red until the rename bounds are contained by the FileEntry tile; environment/provision failures are not valid RED evidence.
