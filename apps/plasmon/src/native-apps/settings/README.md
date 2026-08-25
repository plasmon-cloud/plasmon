# Settings

<!-- plasmon-docs-review:v1 sha256=43d31ee31a5177bbb00ac07f3889d5c481800a8a18ddb9e735ccdd4405d74234 base=1b083268b6a3d930ad4ecad2d67d98c0167c0938 -->

Settings is the Plasmon-native settings/status surface over shared OS capabilities.

`model.ts` currently contains deterministic settings/status models such as filesystem-backed storage summarization. `Settings.tsx` receives capability callbacks/services rather than importing Shell or subsystem internals directly.

Settings is not an authority for filesystem, Shell preferences, backup, sharing, or Kernel capabilities. It presents and invokes those capabilities through their owning services. Unavailable functionality should be represented as unavailable rather than simulated.

## Refactor direction

As Settings expands, define typed settings sections/models backed by injected services and shared preference stores. Avoid a monolithic component with direct imports into every subsystem, and avoid Settings-private persistence for preferences owned elsewhere.

Capability availability should come from the service graph rather than hard-coded build-wave assumptions.

## Testing

Use fast tests for settings models, storage summaries, validation, capability availability, and preference mutations. Use browser tests for navigation/forms/focus and packaged integration where settings interact with real browser/Kernel capabilities.
