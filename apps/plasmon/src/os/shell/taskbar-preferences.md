# Taskbar behavior preferences

Taskbar behavior settings are Shell-owned values on the existing filesystem-backed `ShellPreferencesAuthority` / `ShellPreferenceStore`. They remain part of the `plasmon.shell.preferences.v1` record rather than introducing a taskbar-specific persistence service.

## Canonical fields

The bounded taskbar contract is:

- `taskbarAlignment`: `center` | `left`;
- `taskbarPlacement`: `bottom` | `top`;
- `taskbarIconSize`: `small` | `medium` | `large`;
- `showNeutronTray`: boolean visibility for the aggregate Neutron-trays Shell entry point.

Defaults preserve the pre-setting presentation: centered task buttons, bottom placement, medium/current icon artwork scale, and the aggregate Neutron-trays entry point visible. The clock/calendar remains a core Shell status item and is not conditional on these preferences.

Persisted v1 preference objects created before the placement, icon-size, and tray-visibility fields existed normalize deterministically to `bottom`, `medium`, and `true`. Explicit unsupported values remain invalid rather than being silently strengthened into future taskbar capabilities.

## Live application and geometry ownership

Shell subscribes to the canonical preference authority and applies supported changes live.

Bottom/Top placement changes the rendered horizontal taskbar edge and the rendered workspace inset. `WindowLayer` remains the sole bridge from the actual rendered workspace dimensions into `WindowManager`, so Windowing continues to own usable viewport constraints, window identity, live geometry, snap/maximize behavior, and durable placement. Shell must not write saved window geometry when taskbar placement changes.

Shell-owned Start/Search/tray/calendar panels follow the taskbar edge. Taskbar context menus continue to use the existing source-adjacent bounded placement policy, which chooses the available side of the invoking taskbar source rather than storing placement-specific browser geometry.

Task icon size changes artwork scale only. Existing task-button interaction targets, keyboard semantics, grouping, Process projection, and Windowing behavior stay unchanged.

`showNeutronTray` hides or shows only the aggregate Shell entry point. It does not modify Neutron tray declarations, Element runtime truth, or introduce per-Element tray placement.

## Consumer boundary

Canonical Settings may read, subscribe to, and save these fields through the injected `ShellPreferencesAuthority`. Settings does not own their defaults, validation, migration, persistence, layout behavior, or a mirrored taskbar model. The dedicated Settings consumer remains separately owned and consumes this authority.

This contract does not include left/right vertical taskbars, auto-hide, multi-monitor taskbars, a generic tray registry, or Shell-owned window geometry.
