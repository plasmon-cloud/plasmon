# Plasmon native windowing

This directory implements the native Plasmon window manager behind the frozen `WindowManager` contract. It owns window geometry, z-order, focus, minimum dimensions, minimize/maximize/restore state, viewport reflow, subscriptions, and the native floating-window interaction primitive.

It does **not** own process records, application registration, filesystem state, shell/taskbar state, or Neutron Kernel tiles. Real Neutron Elements remain Kernel-owned sibling tiles.

## Public pieces

- `NativeWindowManager` — contract implementation and window state store.
- `NativeWindow` — polished React window chrome with RAF-driven drag/resize previews.
- `WindowLayer` — subscribes to a manager, identifies the active window, and reports container viewport changes to `NativeWindowManager` when supported.
- `useWindowStates` — small React subscription helper for consumers that need the window list.
- `geometry.ts` / `interaction.ts` — pure geometry and interaction utilities.

## State invariants

- Window IDs are runtime identities and never reused while a window is live.
- `list()` and `get()` return detached snapshots; consumers cannot mutate the store by retaining objects.
- Focus uses a monotonically increasing z sequence. Large z sequences are compacted while preserving ordering.
- Focusing a minimized window makes it visible before raising it. A minimized maximized window remains maximized, and its `restoreGeometry` is preserved.
- Per-window `minWidth`/`minHeight` from `WindowCreateOptions` are enforced for normal windows.
- A normal window may be partially outside the viewport, but a reachable titlebar region is always preserved.
- If the viewport is smaller than a window's minimum dimensions, minimum dimensions win and the titlebar remains reachable.
- Maximized windows exactly follow the current available viewport, even when it is smaller than their normal minimum dimensions; presentation min-size constraints are disabled while maximized.
- `maximize()` captures `restoreGeometry` once. Viewport changes do not destroy that saved geometry.
- Restoring a minimized maximized window first returns it to the maximized state. A second `restore()` unmaximizes it to the saved geometry. This matches taskbar restore behavior without losing maximize state.
- Unknown IDs and idempotent state operations are no-ops and do not emit subscription updates.

## Viewport ownership

`NativeWindowManager` can use a supplied viewport provider, the browser viewport, or an explicit `setViewport()` override. `WindowLayer` observes its own container with `ResizeObserver` and supplies that available rectangle when the manager supports `setViewport()`.

Integration should size `WindowLayer` to the actual native-window work area. If the shell reserves taskbar space, the layer itself should exclude that space rather than teaching the window manager about shell internals.

Call `dispose()` when permanently discarding a manager instance so its optional browser resize listener is removed.

## Interaction behavior

Drag and resize do not update the shared window store for every pointer event. Pointer movement records the latest geometry and one `requestAnimationFrame` imperatively updates the active DOM window. The final geometry is committed to `WindowManager` on pointer-up. This keeps expensive app content from rerendering merely because a pointer moved.

Eight edge/corner resize hit zones provide native cursors. During drag/resize, iframe pointer events and document text selection are temporarily disabled and then restored exactly, including if pointer capture is lost unexpectedly. Clicking a window raises it; active-window z changes return keyboard focus to the window when focus is currently outside it.

Minimized `NativeWindow` roots retain `aria-hidden` and also use the platform `inert` attribute, excluding the entire subtree from pointer interaction and sequential/programmatic focus until the window becomes visible again. The repository's current Bun test setup has no browser DOM harness, so controller lifecycle is covered automatically but native browser focus behavior of `inert` is not claimed as a browser-automated test here.

Titlebar double-click toggles maximize/restore. Window controls use SVG glyphs. Minimize/maximize/open/close transitions consume the shared `--plasmon-*` visual tokens and honor `prefers-reduced-motion`.

## Closing and processes

`WindowManager.close()` only closes the window record. A process host should normally pass `onRequestClose` to `NativeWindow` and delegate that callback to `ProcessController.close(processId)` so the process and its window close together. If no callback is supplied, `NativeWindow` falls back to `WindowManager.close()`.

## daedalOS attribution

The interaction design intentionally adapts generic behavior from daedalOS `components/system/Window/RndWindow/**`: eight resize zones/cursors, focus routing from resize interactions, and temporary iframe pointer suppression while moving/resizing. See `THIRD_PARTY.md` for the upstream paths and MIT notice.
