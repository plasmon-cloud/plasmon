# Settings


Settings is the Plasmon-native settings/status surface over shared OS capabilities.

`model.ts` currently contains deterministic settings/status models such as filesystem-backed storage summarization. `Settings.tsx` receives capability callbacks/services rather than importing Shell or subsystem internals directly.

Settings is not an authority for filesystem, Shell preferences, diagnostics, backup, sharing, or Kernel capabilities. It presents and invokes those capabilities through their owning services. Unavailable functionality should be represented as unavailable rather than simulated.

## Diagnostics

Diagnostic sink preferences are owned by the shared filesystem-backed `DiagnosticSettingsStore`, not by the Settings application. Missing or invalid persisted values fall back independently to `info` for `/System/system.log` and `warn` for the browser console.

Remote incident reporting is disabled by default and is exposed only when the composed build actually includes a remote incident sink. Slim never exposes that control. Changing or disabling remote policy does not disable the local filesystem or browser-console diagnostic sinks.

## Refactor direction

As Settings expands, define typed settings sections/models backed by injected services and shared preference stores. Avoid a monolithic component with direct imports into every subsystem, and avoid Settings-private persistence for preferences owned elsewhere.

Capability availability should come from the service graph rather than hard-coded build-wave assumptions.

## Testing

Use fast tests for settings models, storage summaries, validation, capability availability, and preference mutations. Use browser tests for navigation/forms/focus and packaged integration where settings interact with real browser/Kernel capabilities.
