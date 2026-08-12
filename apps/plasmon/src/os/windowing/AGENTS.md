# Windowing agent instructions

## Authority

`windowing/**` owns Plasmon-local window state, geometry, z-order, focus/visibility state, viewport constraints, rendering, and pointer/resize interaction primitives.

## Rules

- Window state is local UI/runtime state, not Neutron AppScope/tile or process ownership.
- Keep state transitions and geometry semantics in the manager/pure helpers rather than scattering them through React event handlers.
- Preserve usable/reachable window geometry across viewport and visibility state changes.
- Manager snapshots must not expose mutable internal state.
- Subscriptions must reflect real state changes and clean up correctly.
- Process storage/lifecycle remains outside this directory; coordinate through public contracts.
- A native-window close control is an ordinary lifecycle request when an `onRequestClose` callback is supplied. A rejected/deferred callback result must restore Windowing's rendered state rather than pretending teardown occurred.
- Direct `WindowManager.close()` is lower-level window-state teardown; Plasmon ordinary application close controls must route through Process lifecycle negotiation instead of calling it directly.
- Browser-specific pointer/focus/accessibility behavior belongs in the rendering/interaction adapter, not in unrelated Shell/app code.
- Preserve applicable third-party attribution/adaptation notes in `THIRD_PARTY.md`.

## Refactor direction

Prefer a deterministic manager plus thin DOM adapters. Avoid introducing Shell layout rules, process/app lifecycle policy, app-specific behavior, or duplicate geometry state here.

## Validation

Use geometry/manager tests for deterministic state and browser tests for pointer capture, drag/resize, focus, close-animation presentation, iframe suppression, accessibility/inert, ResizeObserver, and other DOM-dependent behavior.
