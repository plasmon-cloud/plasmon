# Plasmon Shell

`shell/**` owns shell-level presentation and orchestration around the central Desktop/native-window workspace: Start, Search, taskbar/tray, calendar, flyouts/context menus, pinning, and shell preferences.

Shell derives state from public authorities. Native task state comes from `ProcessController`/`WindowManager`; external application state comes from `NeutronBridge`; filesystem/search/start content comes from filesystem/shared resource services. Shell must not become a second install database, process store, filesystem, or generic resource-opening authority.

Filesystem-backed Start and Search activation delegates to the canonical `FilesystemOpenDispatcher`. Shell keeps Start-folder navigation, Search result selection, overlay dismissal, pinning, and genuinely non-filesystem native/Element actions, but does not duplicate directory/shortcut/system-app/Neutron-app/association launch policy.

Shell Search recognizes Neutron application projections only through canonical filesystem resource classification/metadata. A projection remains a filesystem resource with stable `NodeId`; when the same Element is also present through direct Neutron discovery, Search emits one application result, uses the direct Element's current presentation metadata where available, and retains the projection node for canonical filesystem opening. This de-duplication does not make the filesystem an installation authority.

Neutron applications are presented in Search as applications rather than package resources: user-facing title, description, and icon come from canonical Element/projection metadata while the underlying `.neutron` filename and `NodeId` remain unchanged. Confirmed runtime observations use user-facing state text, and an `unknown` observation remains explicitly unavailable rather than being presented as stopped; raw `yes`/`no`/`unknown` transport tokens are not Search presentation.

## Production models

The directory already separates a number of deterministic concerns:

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
- `startMenu.ts` — Start inventory, reconciliation, and shortcut presentation metadata;
- `interactions.ts` — shared Shell dismissal/context-ownership decisions plus compatibility re-exports of taskbar interaction policy;
- `subscriptions.ts` — derived-state invalidation;
- `calendar.ts` — date/calendar calculations.

`Shell.tsx` composes those models with Shell-global flyout exclusivity, Escape/outside dismissal, canonical activation callbacks, DOM/browser lifecycle, and rendering. Focused Shell adapters may live beside it when their gesture/presentation boundary is independently testable; taskbar compatibility re-exports do not retain taskbar state, and the taskbar implementation/authority translation remains in `taskbar.ts`. Search query/category/request state and Search result JSX are not duplicated in `Shell.tsx` after the Search surface cutover.

### Resource presentation

Start, Search, tray, and taskbar render resource/application identity through the shared Visual `ResourceIcon` primitive and its semantic sizing contexts. Plasmon-owned folder/file/system fallback artwork comes from `visual/assets.ts`; native application definitions and Neutron Elements remain authoritative for their own artwork. System native definitions that use Plasmon-owned artwork reference those shared assets directly rather than publishing Shell-only symbolic glyphs.

`ShellIcon` is a rendering adapter only. Image loading/failure, generic application fallback, shortcut overlay composition, and context sizing belong to shared Visual presentation. Shell may choose which already-authoritative application/shortcut metadata is relevant to a Start/Search/taskbar row, but it does not classify MIME/types, resolve filesystem shortcut execution, choose associations, or own application installation. Missing artwork degrades to the shared application fallback rather than a Shell-specific initials system.

Taskbar presentation is one deterministic projection of existing authorities rather than a lifecycle store. Native pinned/running/active state is derived from current Process and Windowing snapshots; canonical focus comes only from `WindowManager.focusSnapshot()` and never from z-order. Transient launch state may reflect an in-progress Shell action; Element running state comes from `NeutronBridge`, and an unavailable runtime observation remains explicitly uncertain rather than being interpreted as stopped. The projection retains application, process, and window identity separately and does not persist a second running-app inventory.

Native taskbar entries are grouped at application/handler identity while retaining the current ordered `ProcessRecord` members as canonical member identity. A zero-member group is pinned-only, a single member keeps the direct launch/focus/minimize task-button behavior, and a multi-member group opens a bounded chooser. The chooser stores only which handler is open; its rows are re-derived from current Process/Windowing snapshots, and selecting a running member delegates to `ProcessController.focus()` so Windowing remains authoritative for restore/focus/z-order behavior. A starting sibling does not disable an already-running member group.

Taskbar context menus are presentation over those same authorities. Item/background menus use pure taskbar placement policy from the invoking DOM source and current viewport; the policy stores no browser geometry. A native `Close` is exposed only when the context resolves to one concrete canonical process and delegates to ordinary `ProcessController.close()` negotiation rather than `forceClose` or direct WindowManager mutation. Center/Left taskbar alignment is persisted through the existing Shell preference store and changes only the application-button group; tray/status placement remains independently owned by the taskbar status surface.

Alt-Tab likewise consumes rather than redefines Windowing authority. `AltTabBoundary` snapshots the current `WindowManager.focusSnapshot().mru` only for the lifetime of a held Alt gesture, filters that snapshot against live windows, and stores only the selected window ID. Opening or cycling the chooser never calls focus and never derives order from z-order, process arrays, taskbar grouping, or DOM order. Alt release commits the selected ID through `WindowManager.focus()`, which remains responsible for restoring minimized windows and promoting canonical MRU; Escape, blur, and hidden-page cleanup cancel without changing focus. Process records contribute labels/icons only and remain lifecycle/presentation metadata rather than switching authority.

`/System/Start Menu` remains the durable filesystem authority for Start. Default Settings, Explorer, and Properties shortcuts are seeded directly at that Start root rather than under a managed visible `System` category. Managed categories created by Shell reconciliation carry durable folder provenance, while an existing same-name directory is never retroactively adopted as managed. For released pre-provenance installs, the former managed `System` category has a bounded one-time-compatible backfill: migration is allowed only when the v1 seed ledger names all three canonical identities, those identities are singletons across Start, the folder and shortcuts are exact defaults, and durable creation/modification timestamps show that neither the folder nor its shortcuts were renamed, moved, replaced, copied, or otherwise changed after creation. That exact untouched released state is migrated to the Start root with shortcut NodeIds preserved and the empty legacy category removed. Any user rename, move, replacement, duplicate, metadata/content customization, or otherwise ambiguous state fails closed and is preserved. Reconciliation remains duplicate-free and idempotent, and filesystem `/System` is unaffected.

The native registry is also allowed to contain `runtimeOnly` process-host definitions. Those definitions stay available to Process and association opening, but Start default seeding and the direct native-application Search inventory project only user-launchable definitions (`runtimeOnly !== true`). When a previously managed Start seed later becomes runtime-only, reconciliation retires only the exact ledger-backed default entry whose canonical folder/name, shortcut metadata, and empty content still prove managed ownership; renamed, moved, deleted, metadata/content-customized, and user-created shortcuts are preserved. Shell does not infer this distinction from handler names or create a parallel application catalog.

## Refactor direction

`Shell.tsx` still coordinates many independent state machines. Continue moving Start/Search/flyout action logic into production controllers/models where it can be tested without rendering the entire shell. Taskbar lifecycle/presentation derivation belongs in the focused taskbar projection; React should render that projection and translate user intent into canonical Process/Windowing/Shell commands rather than rebuilding running/focus state locally.

Start/Search/taskbar inventories should continue to derive from shared authorities rather than introducing shell-owned application truth. Preference persistence remains behind the approved filesystem-backed store. Treat unavailable/uncertain external runtime information as uncertainty rather than inventing stronger Kernel knowledge.

Feature-completeness work should use mature desktop conventions for discoverability and keyboard/pointer behavior while preserving these authority boundaries.

## Testing

Use fast tests for taskbar projection/actions/menu policy, Alt-Tab MRU/cycle/reconciliation policy, pin/preferences semantics, canonical Search classification/query ordering plus deterministic Search surface state, Start reconciliation/models, calendar, click-away/context decisions, subscription invalidation, canonical filesystem activation adapters, and shared presentation adapters. Use RTL for Search query/category/result semantics and keyboard/focus behavior that does not depend on browser layout. Use the shared headless Plasmon environment for cross-authority activation semantics. Use real-browser tests for global keyboard shortcuts, focus movement, flyout/context-menu pointer routing, taskbar visible state, lifecycle events, and other DOM-dependent behavior. Installed Neutron checks are appropriate when the claim specifically involves a real Kernel application/tile; packaged-browser coverage is required for Plasmon-owned asset mount behavior.
