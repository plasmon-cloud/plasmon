# Plasmon Shell

`shell/**` owns shell-level presentation and orchestration around the central Desktop/native-window workspace: Start, Search, taskbar/tray, calendar, flyouts/context menus, pinning, and shell preferences.

Shell derives state from public authorities. Native task state comes from `ProcessController`/`WindowManager`; external application state comes from `NeutronBridge`; filesystem/search/start content comes from filesystem/shared resource services. Shell must not become a second install database, process store, filesystem, or generic resource-opening authority.

Filesystem-backed Start and Search activation delegates to the canonical `FilesystemOpenDispatcher`. Shell keeps Start-folder navigation, Search result selection, overlay dismissal, pinning, and genuinely non-filesystem native/Element actions, but does not duplicate directory/shortcut/system-app/Neutron-app/association launch policy.

Shell Search recognizes Neutron application projections only through canonical filesystem resource classification/metadata. A projection remains a filesystem resource with stable `NodeId`; when the same Element is also present through direct Neutron discovery, Search emits one application result, uses the direct Element's current presentation metadata where available, and retains the projection node for canonical filesystem opening. This de-duplication does not make the filesystem an installation authority.

Neutron applications are presented in Search as applications rather than package resources: user-facing title, description, and icon come from canonical Element/projection metadata while the underlying `.neutron` filename and `NodeId` remain unchanged. Confirmed runtime observations use user-facing state text, and an `unknown` observation remains explicitly unavailable rather than being presented as stopped; raw `yes`/`no`/`unknown` transport tokens are not Search presentation.

## Production models

The directory already separates a number of deterministic concerns:

- `activation.ts` — thin Start/Search adapters into canonical filesystem opening;
- `model.ts` — taskbar/tray derivation, user-facing taskbar presentation state, and native task actions;
- `preferences.ts` — persisted shell preferences;
- `search.ts` — search/query inventory, classification, limits, and invalidation;
- `startMenu.ts` — Start inventory, reconciliation, and shortcut presentation metadata;
- `interactions.ts` — click-away/context/pin decisions;
- `subscriptions.ts` — derived-state invalidation;
- `calendar.ts` — date/calendar calculations.

`Shell.tsx` composes those models with DOM/browser lifecycle, flyouts, keyboard/pointer events, and rendering.

### Resource presentation

Start, Search, tray, and taskbar render resource/application identity through the shared Visual `ResourceIcon` primitive and its semantic sizing contexts. Plasmon-owned folder/file/system fallback artwork comes from `visual/assets.ts`; native application definitions and Neutron Elements remain authoritative for their own artwork. System native definitions that use Plasmon-owned artwork reference those shared assets directly rather than publishing Shell-only symbolic glyphs.

`ShellIcon` is a rendering adapter only. Image loading/failure, generic application fallback, shortcut overlay composition, and context sizing belong to shared Visual presentation. Shell may choose which already-authoritative application/shortcut metadata is relevant to a Start/Search/taskbar row, but it does not classify MIME/types, resolve filesystem shortcut execution, choose associations, or own application installation. Missing artwork degrades to the shared application fallback rather than a Shell-specific initials system.

Taskbar presentation is a projection of existing authorities rather than a lifecycle store. Native pinned/running/active state is derived from Process and Windowing snapshots; transient launch state may reflect an in-progress Shell action; Element running state comes from `NeutronBridge`, and an unavailable runtime observation remains explicitly uncertain rather than being interpreted as stopped.

Native taskbar entries are grouped at application/handler identity while retaining the current ordered `ProcessRecord` members as canonical member identity. A zero-member group is pinned-only, a single member keeps the direct launch/focus/minimize task-button behavior, and a multi-member group opens a bounded chooser. The chooser stores only which handler is open; its rows are re-derived from current Process/Windowing snapshots, and selecting a running member delegates to `ProcessController.focus()` so Windowing remains authoritative for restore/focus/z-order behavior. A starting sibling does not disable an already-running member group.

`/System/Start Menu` remains the durable filesystem authority for Start. Default Settings, Explorer, and Properties shortcuts are seeded directly at that Start root rather than under a managed visible `System` category. Retirement of the former managed `System` child is deliberately conservative: only the exact previously-seeded, uncustomized legacy default shape is migrated; user renames, moves, deletions, folder metadata, or extra content prevent migration and are preserved.

The native registry is also allowed to contain `runtimeOnly` process-host definitions. Those definitions stay available to Process and association opening, but Start default seeding and the direct native-application Search inventory project only user-launchable definitions (`runtimeOnly !== true`). When a previously managed Start seed later becomes runtime-only, reconciliation retires only the exact ledger-backed default entry whose canonical folder/name, shortcut metadata, and empty content still prove managed ownership; renamed, moved, deleted, metadata/content-customized, and user-created shortcuts are preserved. Shell does not infer this distinction from handler names or create a parallel application catalog.

## Refactor direction

`Shell.tsx` still coordinates many independent state machines. Continue moving Start/Search/taskbar/flyout action logic into production controllers/models where it can be tested without rendering the entire shell. Keep React focused on composition and browser events.

Start/Search/taskbar inventories should continue to derive from shared authorities rather than introducing shell-owned application truth. Preference persistence remains behind the approved filesystem-backed store. Treat unavailable/uncertain external runtime information as uncertainty rather than inventing stronger Kernel knowledge.

Feature-completeness work should use mature desktop conventions for discoverability and keyboard/pointer behavior while preserving these authority boundaries.

## Testing

Use fast tests for task derivation/actions, pin/preferences semantics, search classification/query ordering, Start reconciliation/models, calendar, click-away/context decisions, subscription invalidation, canonical filesystem activation adapters, and shared presentation adapters. Use the shared headless Plasmon environment for cross-authority activation semantics. Use real-browser tests for global keyboard shortcuts, focus movement, flyout/context-menu pointer routing, taskbar visible state, lifecycle events, and other DOM-dependent behavior. Installed Neutron checks are appropriate when the claim specifically involves a real Kernel application/tile; packaged-browser coverage is required for Plasmon-owned asset mount behavior.
