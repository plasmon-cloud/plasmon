# Settings

<!-- plasmon-docs-review:v1 sha256=9a77d0530e8250d2b339ad60d291692bde88870149dabca8f71909ad249fef1c base=0c9f91b341800f91113aeb269a6438165eb825c8 -->

Settings is the Plasmon-native settings/status surface over shared OS capabilities.

`model.ts` currently contains deterministic settings/status models such as filesystem-backed storage summarization. `Settings.tsx` receives capability callbacks/services rather than importing Shell or subsystem internals directly.

Settings is not an authority for filesystem, Shell preferences, backup, sharing, or Kernel capabilities. It presents and invokes those capabilities through their owning services. Unavailable functionality should be represented as unavailable rather than simulated.

## Refactor direction

As Settings expands, define typed settings sections/models backed by injected services and shared preference stores. Avoid a monolithic component with direct imports into every subsystem, and avoid Settings-private persistence for preferences owned elsewhere.

Capability availability should come from the service graph rather than hard-coded build-wave assumptions.

## Testing

Use fast tests for settings models, storage summaries, validation, capability availability, and preference mutations. Use browser tests for navigation/forms/focus and packaged integration where settings interact with real browser/Kernel capabilities.
