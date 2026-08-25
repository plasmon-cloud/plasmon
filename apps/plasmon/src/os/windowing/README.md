# Plasmon native windowing


`windowing/**` owns Plasmon-local floating-window state and interaction behind the public `WindowManager` contract. It manages window identity, geometry, z-order, explicit focus/MRU history, minimize/maximize/restore state, deterministic left/right edge snapping, viewport constraints, subscriptions, and the browser interaction layer used to move/resize native windows.

It does not own process records, application registration, filesystem state, Shell/taskbar state, or Neutron Kernel tiles.

## Main pieces

- `NativeWindowManager.ts` — deterministic window-state manager, explicit focus/MRU ledger, geometry commits, bounded default placement, and left/right snap transitions.
- `geometry.ts` — pure viewport/window constraints, shared reachable-titlebar position bounds, and half-screen snap calculations.
- `placement.ts` — filesystem-backed durable placement adapter plus the coordinator that restores/persists accepted manager geometry without becoming a second geometry authority.
- `NativeWindow.tsx` — public native-window composer. It binds canonical manager state, close-lifecycle negotiation, simple manager commands, browser interaction bindings, and chrome without owning pointer state or duplicating manager state.
- `useNativeWindowInteraction.ts` — internal browser mechanism/capability adapter. It owns pointer capture/session cleanup, DOM/workspace coordinate translation, RAF-only transient geometry drawing, optional manager capability probes, snap-preview intent, iframe/selection suppression, and authoritative commit/cancel routing.
- `NativeWindowChrome.tsx` — internal presentation-only titlebar/content/control/resize-handle/snap-preview chrome. It consumes state and injected callbacks and does not import manager capability interfaces.
- `interaction.ts` — reusable interaction helpers, including bounded horizontal edge detection, fitting-window full-workspace active drag bounds, oversized reachable-titlebar drag bounds, resize geometry, and pointer-anchored snapped-window restore geometry.
- `WindowLayer.tsx` — subscribes to manager state, renders active presentation from explicit manager focus, and connects the available DOM viewport to the manager.
- `useWindowStates.ts` — React subscription helper.

The manager returns detached state snapshots and emits updates when authoritative state changes. Browser rendering/interaction consumes manager state rather than becoming a second geometry or focus store. Internal browser/chrome modules stay unexported from `windowing/index.ts`; `NativeWindow` remains the public rendered composition seam.

A rendered native close control is a request, not lifecycle authority. When `NativeWindow` receives `onRequestClose`, the callback owns the lifecycle decision; returning `false` means the close was prevented or deferred and the window restores its ordinary rendered state. Plasmon composition routes this callback through `ProcessController.close()`. Direct `WindowManager.close()` remains lower-level window-state teardown for the caller that already owns that decision.

## Focus and MRU semantics

`WindowManager.focusSnapshot()` is the authoritative current-focus/MRU read seam. Its `mru` list is newest-first and is updated by window creation and successful focus-producing transitions; repeated focus promotes an existing identity without duplication. Z-order remains a separate presentation/stacking concern, so z compaction never reconstructs or rewrites focus history.

Minimized windows remain in MRU history because an explicit `focus()` or `restore()` can make them visible again, preserving the existing focus-restores-minimized contract. A minimized window is not eligible for automatic fallback. When the focused window is minimized or closed, the manager activates the newest still-existing, non-minimized MRU window; if none is available, `focusedId` becomes `null`. Closing a window removes its identity from MRU immediately. Restoring or explicitly focusing a previously minimized window promotes it back to the MRU front.

Shell may consume this seam for presentation such as a future keyboard switcher, but it must not maintain a competing focus history or infer MRU from z-order.

## Placement and restore semantics

Manager-created default windows use a deterministic diagonal cascade constrained to the current usable viewport. For each new default, WindowManager scans the bounded cascade from the first slot and chooses the first slot not occupied by current live/restorable manager geometry. Closing or moving a window can therefore free an earlier slot for deterministic reuse without colliding with a later live default. When every reasonable bounded slot is occupied, placement wraps to the first slot deterministically. This avoids lifetime launch counters and keeps placement derived from WindowManager's authoritative geometry state. Explicit coordinates continue to enter through the normal manager constraint path and are not replaced by default-placement policy.

A snapped window occupies the deterministic left or right half of the manager's current available viewport. The native manager keeps snap identity below React and stores a pre-snap floating `restoreGeometry`. During a drag, the browser adapter uses the same pure half-screen geometry to present a pointer-inert snap target before release; final snap state and geometry are still committed only through the manager.

Active floating drag previews use a stricter usable-workspace bound than the manager's ordinary reachable-titlebar constraint when the window fits: the full rectangle stays inside the current WindowLayer throughout pointer movement. When the window is wider than the available viewport, horizontal active drag instead uses the shared manager-compatible reachable-titlebar range so the right-side control cluster can be brought on-screen without allowing the window to become unreachable. Oversized vertical drag remains titlebar/top anchored. These are deterministic Windowing policies, not a second persisted or React-owned placement authority.

Minimize/focus preserve snap placement. Maximizing a snapped window temporarily presents the maximized viewport while retaining the underlying snap placement; restoring returns to that snap first, and restoring the snapped window again returns to its pre-snap floating geometry. Beginning a titlebar drag on a snapped window restores its floating size and repositions that rectangle under the current pointer so the titlebar grab offset remains continuous, then subsequent drag movement uses the same bounded active-drag helper. Viewport changes recompute snapped geometry without replacing the saved floating restore geometry.

Durable placement uses the same filesystem-backed `FsService` persistence boundary as other Plasmon preferences. `NativeWindowPlacementController` observes only authoritative manager snapshots after a manager state change; pointer-move animation frames remain DOM previews and are never persisted. For snap/maximize/minimize presentation, the durable record is the normal/restorable rectangle (`restoreGeometry` when present), not the transient presented rectangle or visibility state.

The stable durable key is the native application's `NativeAppDefinition.id`, not a `ProcessId` or `WindowId`. Only the first live window for a given app id owns that durable primary slot; concurrent sibling windows retain normal WindowManager cascade behavior and are not serialized as a session layout. On reopen, the saved rectangle is reapplied through WindowManager mutation methods, so current viewport and minimum-size constraints clamp stale/out-of-range records. Missing or corrupt records leave the manager-created default placement unchanged.

Default/session placement and durable application placement are intentionally separate authorities within Windowing: #177 chooses a bounded manager default for a newly created window, while the #117 persistence controller may subsequently reapply an accepted durable normal rectangle through the same manager. Neither Shell nor React stores a competing placement model.

This slice remains intentionally bounded to one normal/restorable rectangle per native app plus existing left/right snap behavior. Quarter snapping, tiling policy, multi-monitor/workspace placement, persisted snap/maximize/minimize/focus state, and Shell-owned geometry are outside this subsystem behavior.

## Refactor direction

Keep geometry and state transitions deterministic and testable below React. Browser-specific pointer capture, animation-frame previews, focus routing, edge detection, iframe interaction suppression, and capability adaptation stay in `useNativeWindowInteraction.ts`. Rendered titlebar/control/resize/snap-preview markup stays in `NativeWindowChrome.tsx`. `WindowLayer.tsx` remains the sole ResizeObserver/workspace viewport bridge, while close-animation presentation/lifecycle negotiation remains composed by `NativeWindow.tsx` around the caller-owned close decision.

Do not teach the window manager Shell layout or process lifecycle policy; composition should provide the actual available viewport and lifecycle close callback. Keep process ownership outside this subsystem and coordinate through public contracts.

Upstream behavioral adaptations/attribution belong in `THIRD_PARTY.md` and remain preserved through refactors.

## Testing

Use pure geometry/manager tests for creation, bounded default free-slot selection/wrap, explicit focus/MRU transitions and fallback, z-order independence/compaction, viewport constraints, snap placement/state transitions, fitting and oversized active-drag bounds, resize geometry, pointer-anchored unsnap geometry, durable normal-placement restoration/clamping, snapshot isolation, subscriptions, and cleanup. Use headless production composition for filesystem-backed close/recomposition persistence. Use real-browser coverage where pointer drag/resize, snap-target presentation, snapped-window pointer continuity, pointer-edge activation, small-viewport control reachability, default-window reachability in actual layout, keyboard/focus routing, close-animation presentation, inert/accessibility, iframe interaction, ResizeObserver, or another DOM-owned behavior is material. Manual review remains appropriate for animation/interaction feel.
