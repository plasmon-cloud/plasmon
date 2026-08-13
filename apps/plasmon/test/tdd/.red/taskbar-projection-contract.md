# Issue #198 — future taskbar projection contract

```text
FsService-backed pins
+ NativeApplicationRegistry definitions
+ canonical Process records
+ canonical Windowing states/focus
+ shared Visual/application presentation
-> deterministic taskbar projection
```

## Preserve

- no second running-app registry;
- Process lifecycle and close negotiation remain authoritative;
- Windowing focus/minimize/z-order remain authoritative;
- pin persistence uses accepted FsService-backed preferences;
- unknown Element runtime remains uncertain;
- taskbar actions are commands to Process/Windowing/Neutron, not local state.

## Projection fields

Every entry/group must expose stable identity, display presentation, pin state,
runtime state, active/focused state, minimized/running state, accessible name,
and accepted child/process/window information. Grouping is #118 behavior and
must preserve child identity.

## Accessibility contract

- taskbar root is a navigation landmark;
- each item has an accessible name containing app title and state;
- active native item exposes accepted pressed/current state;
- launching/uncertain states are exposed without raw `yes/no/unknown` labels;
- grouped chooser exposes group name, child count and keyboard-selectable child
  names once #118 vocabulary exists;
- context menu is a menu with keyboard invocation and focus return;
- minimize/focus toggle behavior is announced through state, not CSS class only.

Exact role/name details must be checked against existing accepted semantics before
implementation; this contract does not prescribe a future component tree.
