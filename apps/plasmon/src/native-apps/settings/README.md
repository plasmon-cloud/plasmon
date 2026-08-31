# Settings

Settings is the Plasmon-native settings/status surface over shared OS capabilities.

`model.ts` contains deterministic settings/status models such as filesystem-backed storage summarization plus the canonical Settings destination model. `Settings.tsx` receives capability callbacks/services rather than importing Shell or subsystem internals directly.

Settings is not an authority for filesystem, Shell preferences, diagnostics, backup, sharing, or Kernel capabilities. It presents and invokes those capabilities through their owning services. Unavailable functionality should be represented as unavailable rather than simulated.

## Destinations and activation

The singleton `native:settings` application owns a small application-local navigation model. Stable destinations are `home`, `personalization`, `taskbar`, `files`, `storage`, and `diagnostics`. Generic Settings activation, including `/System/Settings.sys`, resolves to `home`. Intentional destination activation carries an opaque `appDestination` through the existing native process target; reopening the singleton updates that target and focuses the existing Settings window rather than creating another process.

Unknown or stale destination values normalize to `home`. Destination state is transient application/navigation state only and is not persisted as a preference authority.

File Associations is not a destination while the association contract lacks a truthful global Settings-facing view/manage capability. The existing per-resource Open With guidance may remain visible from Settings home without creating a Settings-private registry. Backup & sharing is not represented without a functioning capability.

## Diagnostics

Diagnostic sink preferences are owned by the shared filesystem-backed `DiagnosticSettingsStore`, not by the Settings application. Missing or invalid persisted values fall back independently to `info` for `/System/system.log` and `warn` for the browser console.

Remote incident reporting is disabled by default and is exposed only when the composed build actually includes a remote incident sink. Slim never exposes that control. Changing or disabling remote policy does not disable the local filesystem or browser-console diagnostic sinks.

## Refactor direction

As Settings expands, define typed settings sections/models backed by injected services and shared preference stores. Avoid a monolithic component with direct imports into every subsystem, and avoid Settings-private persistence for preferences owned elsewhere.

Capability availability should come from the service graph rather than hard-coded build-wave assumptions.

## Testing

Use fast tests for settings models, storage summaries, destination normalization/activation, validation, capability availability, and preference mutations. Use RTL + user-event for navigation/forms/focus. Use browser tests only when Settings behavior crosses a genuine browser or packaged integration boundary.
