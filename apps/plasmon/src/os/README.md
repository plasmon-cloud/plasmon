# Plasmon OS architecture

`apps/plasmon/src/os/` is the canonical shared desktop-OS layer for Plasmon. It composes filesystem, associations, process/window management, desktop/FileManager, Shell, diagnostics, Neutron integration, Sharing, and shared presentation while leaving Kernel authority with Neutron.

## Architectural boundaries

- `contracts/**` defines the shared vocabulary between subsystems.
- `api/**` defines the dependency-light production OS API semantic capability contract (`OsApi`) and the Plasmon adapter that delegates those capabilities to the owning production authorities. It is the shared high-level automation seam for deterministic tests and future scripting consumers, not a second policy implementation.
- `diagnostics/**` owns structured Plasmon-local diagnostic events and local sink policy. `/System/system.log` is the durable filesystem-backed representation; console output and deterministic subscribers are secondary views of the same sanitized event stream.
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
Production semantic OS capabilities and stable DTOs. `contracts.ts` is intentionally free of concrete Plasmon implementation and test dependencies; `createPlasmonOsApi()` binds the `OsApi` contract to the real service composition. High-level deterministic tests consume the same production API as `env.os`. Test-only powers such as fake failures, global settlement, clocks, impossible-state construction, transport controls, and assertions remain outside this boundary. See [`api/README.md`](api/README.md).

### `diagnostics/`
Production-owned diagnostic event ingestion and local sink policy. Producers emit stable severity/subsystem/event records once; the service applies independent file and console thresholds, redaction, bounded retention, correlation metadata, and failure isolation. The durable log is `/System/system.log` through the existing filesystem persistence authority and is openable through normal filesystem/open associations. The headless environment exposes this same production authority as `env.diagnostics` for deterministic event observation rather than inventing a test-only logger. Remote telemetry/upload and Kernel-wide logging remain separate concerns. See [`diagnostics/README.md`](diagnostics/README.md).

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
Composition of filesystem transport, associations, native app registry, processes, windows, diagnostics, Neutron bridge, open service, clipboard, and other cross-cutting dependencies. Integration wires the diagnostic authority into production subsystem error hooks but does not define subsystem logging policy itself.

### `sharing/`
Explicit local-resource snapshot publication into a stable provider store, content-addressed chunking/integrity, immutable provider identity and provider revisions, plus the safe share/revoke subset over `ResourceAuthorizationService`. The provider storage layer contains no bearer/grant/lease/AppScope authority. Cross-AppScope import remains fail-closed until an accepted live MTN lease-bound provider-call boundary exists.

### `visual/`
Shared visual tokens, resource/app presentation, media/thumbnails, overlays, sizing, and wallpaper primitives.

## Refactor direction

The OS should become easier to reason about by reducing orchestration inside large React surfaces and eliminating duplicate authorities. Prefer:

- headless production models/services/controllers for deterministic actions;
- production OS API operations for high-level deterministic workflows that represent legitimate OS actions, while focused subsystem tests continue to call their subsystem directly;
- structured diagnostic events for operational failures/lifecycle evidence instead of persistent ad-hoc status UI or scattered unstructured console-only logging;
- event/subscription boundaries that invalidate consumers without duplicating authoritative state;
- one generic resource-opening path shared by Desktop, Explorer, Start, Search, and other consumers;
- reusable interaction primitives for repeated desktop behaviors;
- integration code that wires public contracts rather than reaching into private stores;
- compatibility and demo code that can be removed cleanly once migration is verified.

Feature-completeness work may use daedalOS as the inventory/reference, while Windows/macOS inform familiar desktop interaction. Implement those capabilities through these Plasmon/Neutron boundaries rather than adding reference-project architecture.

## Testing strategy

Keep semantic tests close to the owning subsystem. Cross-subsystem deterministic workflows should exercise production composition and use `env.os` when the action is a legitimate OS capability. `env.os` exposes the production OS API (`OsApi`), not a test facade over service internals. When the claim is that production code emitted a diagnostic event, use the same production `DiagnosticService` exposed as `env.diagnostics`; do not create a parallel test logger or infer diagnostics from UI text. Test-only controls for settlement, failures, time, transport, impossible state, or assertions belong beside those production authorities in test support. Browser tests should concentrate on browser-only concerns such as DOM event routing, focus, pointer/drag behavior, iframe/media/runtime APIs, and packaged visible workflows. Package checks are required when the built Neutron artifact or installed asset graph is part of the change.

Manual review remains part of acceptance for visual polish and interaction feel.

Specific regressions, compatibility exceptions, file-format minutiae, and active refactor tasks belong in Issues and focused tests, not in this overview.

## Further reading

Read the nearest subsystem `README.md` and `AGENTS.md` before modifying it. Current cross-subsystem Plasmon authority is indexed by `apps/plasmon/docs/README.md`. Repository Neutron behavior is documented under `/doc/`.
