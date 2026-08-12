# Plasmon native windowing

`windowing/**` owns Plasmon-local floating-window state and interaction behind the public `WindowManager` contract. It manages window identity, geometry, z-order, focus, minimize/maximize/restore state, deterministic left/right edge snapping, viewport constraints, subscriptions, and the browser interaction layer used to move/resize native windows.

It does not own process records, application registration, filesystem state, Shell/taskbar state, or Neutron Kernel tiles.

## Main pieces

- `NativeWindowManager.ts` — deterministic window-state manager, geometry commits, and left/right snap transitions.
- `geometry.ts` — pure viewport/window constraint and half-screen snap calculations.
- `NativeWindow.tsx` — rendered window chrome and thin pointer interaction/edge-detection adapter.
- `interaction.ts` — reusable interaction helpers, including bounded horizontal edge detection.
- `WindowLayer.tsx` — subscribes to manager state and connects the available DOM viewport to the manager.
- `useWindowStates.ts` — React subscription helper.

The manager returns detached state snapshots and emits updates when authoritative state changes. Browser rendering/interaction should consume manager state rather than becoming a second geometry store.

A rendered native close control is a request, not lifecycle authority. When `NativeWindow` receives `onRequestClose`, the callback owns the lifecycle decision; returning `false` means the close was prevented or deferred and the window restores its ordinary rendered state. Plasmon composition routes this callback through `ProcessController.close()`. Direct `WindowManager.close()` remains lower-level window-state teardown for the caller that already owns that decision.

## Placement and restore semantics

A snapped window occupies the deterministic left or right half of the manager's current available viewport. The native manager keeps snap identity below React and stores a pre-snap floating `restoreGeometry`; the browser adapter only detects pointer release at the workspace edge and commits the requested side plus the final floating drag geometry to the manager.

Minimize/focus preserve snap placement. Maximizing a snapped window temporarily presents the maximized viewport while retaining the underlying snap placement; restoring returns to that snap first, and restoring the snapped window again returns to its pre-snap floating geometry. Dragging a snapped window restores its floating geometry before continuing the drag. Viewport changes recompute snapped geometry without replacing the saved floating restore geometry.

This slice is intentionally bounded to left/right halves. Quarter snapping, tiling policy, multi-monitor placement, persisted placement, and Shell-owned snap geometry are outside this subsystem behavior.

## Refactor direction

Keep geometry and state transitions deterministic and testable below React. Browser-specific pointer capture, animation-frame previews, focus routing, ResizeObserver integration, accessibility/inert behavior, edge detection, iframe interaction suppression, and close-animation presentation belong in thin DOM adapters around the manager.

Do not teach the window manager Shell layout or process lifecycle policy; composition should provide the actual available viewport and lifecycle close callback. Keep process ownership outside this subsystem and coordinate through public contracts.

Upstream behavioral adaptations/attribution belong in `THIRD_PARTY.md` and should remain preserved through refactors.

## Testing

Use pure geometry/manager tests for creation, focus/order, viewport constraints, snap placement/state transitions, snapshot isolation, subscriptions, and cleanup. Use real-browser coverage for pointer drag/resize, pointer-edge activation, keyboard/focus, close-animation presentation, inert/accessibility, iframe interaction, ResizeObserver, and other DOM-only behavior. Manual review remains appropriate for animation/interaction feel.
