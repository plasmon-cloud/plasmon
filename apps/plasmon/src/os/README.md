# Plasmon OS architecture


`apps/plasmon/src/os/` is the canonical shared desktop-OS layer for Plasmon. It composes filesystem, associations, process/window management, desktop/FileManager, Shell, Neutron integration, Sharing, and shared presentation while leaving Kernel authority with Neutron.

## Architectural boundaries

- `contracts/**` defines the shared vocabulary between subsystems.
- `api/**` defines the dependency-light production `OsApi` semantic capability contract and the Plasmon adapter that delegates those capabilities to the owning production authorities. It is the shared high-level automation seam for deterministic tests and future scripting consumers, not a second policy implementation.
- `fs/**` is the filesystem semantics/persistence boundary; UI surfaces consume it rather than becoming storage authorities.
- `hiddenVisibility.ts` owns the filesystem-backed OS-wide hidden-resource visibility preference. Settings is the mutation surface; Search and Start consume only that global value plus canonical filesystem/target hiddenness, while Explorer composes it with the independent FileManager-local preference as `global || local` without overwriting local state. `integration/**` wires the shared authority but does not duplicate its policy.
- `associations/**` owns generic handler matching and defaults.
- `process/**` and `windowing/**` own Plasmon-local native app lifecycle/window state.
- `context-menu-boundary.ts` owns only the reusable browser-event ownership decision for first-party context menus. Specialized Shell/FileManager/application menus retain command authority; editable controls and explicitly foreign/iframe content remain unclaimed.
- `resource-command.ts` owns only bounded cross-surface user-action orchestration for commands with demonstrated multiple production consumers. The initial Open command preserves stable NodeId intent and delegates classification, shortcuts, handlers, directory behavior, and opening to the existing filesystem authority.
- `neutron/**` adapts verified Kernel behavior; it must not invent missing Kernel capabilities.
- `integration/**` composes public implementations and should not absorb subsystem policy.
- `sharing/**` owns explicit provider publication/storage semantics and only the authorization orchestration faithfully expressible through current contracts; MTN remains authoritative for cross-AppScope authorization and live provider calls.
- `visual/**` supplies shared presentation primitives without deciding filesystem or application semantics.

Stable identifiers are intentional boundaries. A filesystem node, logical Atom, provider resource/revision, native process, window, and Neutron application are different identities even when one user action connects them.

## Subsystems

### `contracts/`
Shared interfaces and identifiers. Contract changes are cross-subsystem changes and require an implementer/consumer audit.

### `api/`
Production semantic OS capabilities and stable DTOs. `contracts.ts` is intentionally free of concrete Plasmon implementation and test dependencies; `createPlasmonOsApi()` binds that contract to the real service composition. High-level deterministic tests consume the same API as `env.os`. Test-only powers such as fake failures, global settlement, clocks, impossible-state construction, transport controls, and assertions remain outside this boundary. See [`api/README.md`](api/README.md).

### `fs/`
Filesystem service implementation, persistence/RPC boundary, bootstrap and reconciliation, protection/classification policy, projections, Trash/restore support, shortcuts, and filesystem-aware open dispatch.

### `associations/`
Handler registry, deterministic matching/defaults, Open With models, and resource-description helpers used by consumers.

### `process/`
Native application registration/hosting and process lifecycle. This is not Neutron AppScope/process ownership.

### `windowing/`
Native window state, geometry, focus, z-order, minimize/maximize/restore, and interaction primitives.

### `desktop/`
The Desktop presentation over filesystem state and persisted layout metadata.

### `file-manager/`
Reusable filesystem presentation and user file operations used by Desktop and Explorer-style applications.

### `shell/`
Start, Search, taskbar/tray, calendar, flyouts, shell preferences, and shell-level navigation/presentation.

### `neutron/`
The narrow adapter to vanilla Neutron discovery, opening, runtime state, installation mediation, and package metadata supported by the Kernel.

### `integration/`
Composition of filesystem transport, associations, native app registry, processes, windows, Neutron bridge, open service, clipboard, and other cross-cutting dependencies.

### `sharing/`
Explicit local-resource snapshot publication into a stable provider store, content-addressed chunking/integrity, immutable provider identity and provider revisions, plus the safe share/revoke subset over `ResourceAuthorizationService`. The provider storage layer contains no bearer/grant/lease/AppScope authority. Cross-AppScope import remains fail-closed until an accepted live MTN lease-bound provider-call boundary exists.

### `visual/`
Shared visual tokens, resource/app presentation, media/thumbnails, overlays, sizing, and wallpaper primitives.

## Refactor direction

The OS should become easier to reason about by reducing orchestration inside large React surfaces and eliminating duplicate authorities. Prefer:

- headless production models/services/controllers for deterministic actions;
- production `OsApi` operations for high-level deterministic workflows that represent legitimate OS actions, while focused subsystem tests continue to call their subsystem directly;
- event/subscription boundaries that invalidate consumers without duplicating authoritative state;
- one generic resource-opening path shared by Desktop, Explorer, Start, Search, and other consumers;
- reusable interaction primitives for repeated desktop behaviors;
- integration code that wires public contracts rather than reaching into private stores;
- compatibility and demo code that can be removed cleanly once migration is verified.

Feature-completeness work may use daedalOS as the inventory/reference, while Windows/macOS inform familiar desktop interaction. Implement those capabilities through these Plasmon/Neutron boundaries rather than adding reference-project architecture.

## Testing strategy

Keep semantic tests close to the owning subsystem. Cross-subsystem deterministic workflows should exercise production composition and use `env.os` when the action is a legitimate OS capability. `env.os` is the production `OsApi`, not a test facade over service internals. Test-only controls for settlement, failures, time, transport, impossible state, or assertions belong beside that API in test support. Browser tests should concentrate on browser-only concerns such as DOM event routing, focus, pointer/drag behavior, iframe/media/runtime APIs, and packaged visible workflows. Package checks are required when the built Neutron artifact or installed asset graph is part of the change.

Manual review remains part of acceptance for visual polish and interaction feel.

Specific regressions, compatibility exceptions, file-format minutiae, and active refactor tasks belong in Issues and focused tests, not in this overview.

## Further reading

Read the nearest subsystem `README.md` and `AGENTS.md` before modifying it. Current cross-subsystem Plasmon authority is indexed by `apps/plasmon/docs/README.md`; preserved release/refactor/design provenance is under `apps/plasmon/docs/history/`. Repository Neutron behavior is documented under `/doc/`.