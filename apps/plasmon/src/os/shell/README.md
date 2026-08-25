# Plasmon Shell

<!-- plasmon-docs-review:v1 sha256=ed24b09cad65b0b5874aecdabec84397258128009f75f1d536816477df61e8d2 base=9278ff63f39a58528bde8cf715cb3cd3fc4c136e -->

`shell/**` owns shell-level presentation and orchestration around the central Desktop/native-window workspace: Start, Search, taskbar/tray, calendar, flyouts/context menus, pinning, and shell preferences.

Shell derives state from public authorities. Native task state comes from `ProcessController`/`WindowManager`; external application state comes from `NeutronBridge`; filesystem/search/start content comes from filesystem/shared resource services. Shell must not become a second install database, process store, filesystem, or generic resource-opening authority.

Filesystem-backed Start and Search activation delegates to the canonical `FilesystemOpenDispatcher`. Shell keeps Start-folder navigation, Search result selection, overlay dismissal, pinning, and genuinely non-filesystem native/Element actions, but does not duplicate directory/shortcut/system-app/Neutron-app/association launch policy.

Shell Search recognizes Neutron application projections only through canonical filesystem resource classification/metadata. A projection remains a filesystem resource with stable `NodeId`; when the same Element is also present through direct Neutron discovery, Search emits one application result, uses the direct Element's current presentation metadata where available, and retains the projection node for canonical filesystem opening. This de-duplication does not make the filesystem an installation authority.

Neutron applications are presented in Search as applications rather than package resources: user-facing title, description, and icon come from canonical Element/projection metadata while the underlying `.neutron` filename and `NodeId` remain unchanged. Search does not present or index Element runtime state (`yes`, `no`, or `unknown`); running state belongs to taskbar/window presentation rather than application discovery.

## Production models and composition seams

The Shell is split by authority and rendered responsibility:

- `activation.ts` — thin Start/Search adapters into canonical filesystem opening;
- `taskbar.ts` — the focused taskbar projection over pin/application/Process/Windowing state plus canonical task actions and taskbar menu policy;
- `altTab.ts` — pure held-gesture projection/cycling over canonical WindowManager MRU snapshots;
- `AltTabBoundary.tsx` — global Alt-Tab keyboard/presentation adapter that owns only ephemeral switcher selection;
- `model.ts` — non-taskbar Start/tray/general Shell modeling plus compatibility re-exports during the taskbar migration;
- `preferences.ts` — persisted shell preferences;
- `search.ts` — canonical Search inventory/query, projection/classification consumption, limits, filtering, cancellation helper, and invalidation adapter;
- `search-surface-state.ts` — deterministic projection of canonical Search batches into explicit loading/error/warning/empty/result presentation state;
- `use-search-surface-controller.ts` — transient Search query/category/request lifecycle over `searchShell`; it does not discover applications, classify resources, or launch results;
- `SearchSurface.tsx` — rendered Search presentation and semantic result-list keyboard/focus translation;
- `startMenu.ts` and the Start controller/surface files — Start inventory, reconciliation, presentation, and rendered interaction;
- `shell-coordination.ts` — deterministic Shell-global one-flyout/context-menu/taskbar-group coordination only;
- `shell-runtime.ts` — React observation adapters over canonical Process, WindowManager, and Neutron state;
- `ShellSurfaces.tsx` — focused rendered adapters for taskbar, tray, calendar, settings, context menus, and Shell notices;
- `interactions.ts` — shared Shell dismissal/context-ownership decisions plus compatibility re-exports of taskbar interaction policy;
- `subscriptions.ts` — derived-state invalidation;
- `calendar.ts` — date/calendar calculations.

`Shell.tsx` is primarily the composition/orchestration root. It wires external authorities, owns only genuinely Shell-global transient/action coordination, delegates deterministic flyout exclusivity to `shell-coordination.ts`, and composes focused rendered surfaces. Focused gesture boundaries such as `AltTabBoundary` remain independent adapters rather than moving their transient state into Shell. Taskbar compatibility re-exports do not retain taskbar state: implementation and authority translation live in `taskbar.ts`. Search query/category/request state and Search result JSX are not duplicated in `Shell.tsx`; Start inventory/reconciliation likewise remains in the focused Start seam.

Opening a Shell flyout dismisses competing Shell-owned context/taskbar-group surfaces through the coordination model. Escape clears Shell-owned transient presentation, while Ctrl+Escape and Ctrl+Space translate browser keyboard input into that same model. This coordination does not mutate Process or WindowManager state and does not become a second Search, Start, or taskbar authority.

### Resource presentation

Start, Search, tray, and taskbar render resource/application identity through the shared Visual `ResourceIcon` primitive and its semantic sizing contexts. Plasmon-owned folder/file/system fallback artwork comes from `visual/assets.ts`; native application definitions and Neutron Elements remain authoritative for their own artwork. System native definitions that use Plasmon-owned artwork reference those shared assets directly rather than publishing Shell-only symbolic glyphs.

`ShellIcon` is a rendering adapter only. Image loading/failure, generic application fallback, shortcut overlay composition, and context sizing belong to shared Visual presentation. Shell may choose which already-authoritative application/shortcut metadata is relevant to a Start/Search/taskbar row, but it does not classify MIME/types, resolve filesystem shortcut execution, choose associations, or own application installation. Missing artwork degrades to the shared application fallback rather than a Shell-specific initials system.

Taskbar presentation is one deterministic projection of existing authorities rather than a lifecycle store. Native pinned/running/active state is derived from current Process and Windowing snapshots; canonical focus comes only from `WindowManager.focusSnapshot()` and never from z-order. Transient launch state may reflect an in-progress Shell action; Element running state comes from `NeutronBridge`, and an unavailable runtime observation remains explicitly uncertain rather than being interpreted as stopped. The projection retains application, process, and window identity separately and does not persist a second running-app inventory.

Native taskbar entries are grouped at application/handler identity while retaining the current ordered `ProcessRecord` members as canonical member identity. A zero-member group is pinned-only, a single member keeps the direct launch/focus/minimize task-button behavior, and a multi-member group opens a bounded chooser. The chooser stores only which handler is open; its rows are re-derived from current Process/Windowing snapshots, and selecting a running member delegates to `ProcessController.focus()` so Windowing remains authoritative for restore/focus/z-order behavior. A starting sibling does not disable an already-running member group.

Taskbar context menus are presentation over those same authorities. Item/background menus use pure taskbar placement policy from the invoking DOM source and current viewport; the policy stores no browser geometry. A native `Close` is exposed only when the context resolves to one concrete canonical process and delegates to ordinary `ProcessController.close()` negotiation rather than `forceClose` or direct WindowManager mutation. Center/Left taskbar alignment is persisted through the existing Shell preference store and changes only the application-button group; tray/status placement remains independently owned by the taskbar status surface.

Alt-Tab likewise consumes rather than redefines Windowing authority. `AltTabBoundary` snapshots the current `WindowManager.focusSnapshot().mru` only for the lifetime of a held Alt gesture, filters that snapshot against live windows, and stores only the selected window ID. Opening or cycling the chooser never calls focus and never derives order from z-order, process arrays, taskbar grouping, or DOM order. Alt release commits the selected ID through `WindowManager.focus()`, which remains responsible for restoring minimized windows and promoting canonical MRU; Escape, blur, and hidden-page cleanup cancel without changing focus. Process records contribute labels/icons only and remain lifecycle/presentation metadata rather than switching authority.

`/System/Start Menu` remains the durable filesystem authority for Start. Explorer is the only former managed `System` application retained as a managed default Start shortcut; Settings and Properties are no longer managed Start defaults. Shell-created Start categories record their stable folder `NodeId` as durable Start-root provenance, and existing same-name directories are never retroactively adopted as managed. Released v1 installations may backfill the retired managed `System` directory `NodeId`, but only for the exact historical lifecycle that the old reconciler could have produced: the v1 seed ledger must still contain all three former-System identities, the direct `System` directory and its three canonical shortcuts must remain metadata-clean with no root-name collisions, the directory must predate the ledger write represented by the Start-root modification time, and each shortcut must have been created in that directory before that write and never modified afterward. That combined durable-ledger and lifecycle evidence permits a one-time migration/removal of the exact released managed directory; folder name, shape, identities, or timestamps by themselves never establish ownership, and replacement, moved, renamed, deleted, or customized states fail closed. After a proven migration, current #428 inventory retirement removes exact ledger-backed Settings and Properties defaults while preserving Explorer's stable shortcut `NodeId` at Start root. For root-level Settings/Properties retirement, a still-existing provenance-recorded former `System` folder is sufficient move ambiguity; an unproven directory named `System` creates ambiguity only when it still contains an untouched ledger-backed former-System seed whose identity is absent from Start root. An unrelated user-created `System` directory therefore remains untouched but does not keep stale managed root Settings/Properties defaults alive. In an ambiguous legacy-move case reconciliation consumes the retired seed identity but preserves the root shortcut `NodeId`, preventing later reclamation. User renames, moves, replacements, deletions, metadata/content customization, and ambiguous folders are preserved. Reconciliation remains duplicate-free and idempotent, and filesystem `/System` is unaffected.

The native registry is also allowed to contain `runtimeOnly` process-host definitions. Those definitions stay available to Process and association opening, but Start default seeding and the direct native-application Search inventory project only user-launchable definitions (`runtimeOnly !== true`). When a previously managed Start seed later becomes runtime-only, reconciliation retires only the exact ledger-backed default entry whose canonical folder/name, shortcut metadata, and empty content still prove managed ownership; renamed, moved, deleted, metadata/content-customized, and user-created shortcuts are preserved. Shell does not infer this distinction from handler names or create a parallel application catalog.

## Refactor direction

The intended composition boundary is established. Future work should preserve it rather than introducing another root or moving focused state machines back into `Shell.tsx`.

Keep deterministic Shell policy in focused production models/controllers, rendered surface state in explicit surface adapters, and browser event translation at the React boundary. Start/Search/taskbar inventories continue to derive from shared authorities rather than introducing Shell-owned application truth. Preference persistence remains behind the approved filesystem-backed store. Treat unavailable/uncertain external runtime information as uncertainty rather than inventing stronger Kernel knowledge.

Do not create `Shell2`, duplicate Process/Windowing/Search/taskbar state, or a generic global-state framework merely to reduce file size. New Shell features should extend the focused authority or rendered surface that actually owns the behavior.

Feature-completeness work should use mature desktop conventions for discoverability and keyboard/pointer behavior while preserving these authority boundaries.

## Testing

Use fast tests for Shell coordination policy, taskbar projection/actions/menu policy, Alt-Tab MRU/cycle/reconciliation policy, pin/preferences semantics, canonical Search classification/query ordering plus deterministic Search surface state, Start reconciliation/models, calendar, click-away/context decisions, subscription invalidation, canonical filesystem activation adapters, and shared presentation adapters. Use RTL for the composed rendered surfaces and for Search query/category/result semantics and keyboard/focus behavior that does not depend on browser layout. Use the shared headless Plasmon environment for cross-authority activation semantics. Use real-browser tests for global keyboard shortcuts, focus movement, flyout/context-menu pointer routing, taskbar visible state, lifecycle events, and other DOM-dependent behavior. Installed Neutron checks are appropriate when the claim specifically involves a real Kernel application/tile; packaged-browser coverage is required for Plasmon-owned asset mount behavior.
