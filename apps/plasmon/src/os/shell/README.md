# Plasmon Shell

`shell/**` owns shell-level presentation and orchestration around the central Desktop/native-window workspace: Start, Search, taskbar/tray, calendar, flyouts/context menus, pinning, and shell preferences.

Shell derives state from public authorities. Native task state comes from `ProcessController`/`WindowManager`; external application state comes from `NeutronBridge`; filesystem/search/start content comes from filesystem/shared resource services. Shell must not become a second install database, process store, filesystem, or generic resource-opening authority.

Filesystem-backed Start and Search activation delegates to the canonical `FilesystemOpenDispatcher`. Shell keeps Start-folder navigation, Search result selection, overlay dismissal, pinning, and genuinely non-filesystem native/Element actions, but does not duplicate directory/shortcut/system-app/Neutron-app/association launch policy.

Shell Search recognizes Neutron application projections only through canonical filesystem resource classification/metadata. A projection remains a filesystem resource with stable `NodeId`; when the same Element is also present through direct Neutron discovery, Search emits one application result, uses the direct Element's current presentation metadata where available, and retains the projection node for canonical filesystem opening. This de-duplication does not make the filesystem an installation authority.

Neutron applications are presented in Search as applications rather than package resources: user-facing title, description, and icon come from canonical Element/projection metadata while the underlying `.neutron` filename and `NodeId` remain unchanged. Confirmed runtime observations use user-facing state text, and an `unknown` observation remains explicitly unavailable rather than being presented as stopped; raw `yes`/`no`/`unknown` transport tokens are not Search presentation.

## Production models and composition seams

The Shell is split by authority and rendered responsibility:

- `activation.ts` — thin Start/Search adapters into canonical filesystem opening;
- `taskbar.ts` — the focused taskbar projection over pin/application/Process/Windowing state plus canonical task actions and taskbar menu policy;
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

`Shell.tsx` is now primarily the composition/orchestration root. It wires external authorities, owns only genuinely Shell-global transient/action coordination, delegates deterministic flyout exclusivity to `shell-coordination.ts`, and composes focused rendered surfaces. Taskbar compatibility re-exports do not retain taskbar state: implementation and authority translation live in `taskbar.ts`. Search query/category/request state and Search result JSX are not duplicated in `Shell.tsx`; Start inventory/reconciliation likewise remains in the focused Start seam.

Opening a Shell flyout dismisses competing Shell-owned context/taskbar-group surfaces through the coordination model. Escape clears Shell-owned transient presentation, while Ctrl+Escape and Ctrl+Space translate browser keyboard input into that same model. This coordination does not mutate Process or WindowManager state and does not become a second Search, Start, or taskbar authority.

Search frame geometry remains a browser/CSS acceptance concern rather than deterministic Search authority. Measured popup containment and internal scrolling are validated at the real-browser layer; deterministic and RTL Search tests must not invent layout behavior that Happy DOM cannot truthfully measure.

### Resource presentation

Start, Search, tray, and taskbar render resource/application identity through the shared Visual `ResourceIcon` primitive and its semantic sizing contexts. Plasmon-owned folder/file/system fallback artwork comes from `visual/assets.ts`; native application definitions and Neutron Elements remain authoritative for their own artwork. System native definitions that use Plasmon-owned artwork reference those shared assets directly rather than publishing Shell-only symbolic glyphs.

`ShellIcon` is a rendering adapter only. Image loading/failure, generic application fallback, shortcut overlay composition, and context sizing belong to shared Visual presentation. Shell may choose which already-authoritative application/shortcut metadata is relevant to a Start/Search/taskbar row, but it does not classify MIME/types, resolve filesystem shortcut execution, choose associations, or own application installation. Missing artwork degrades to the shared application fallback rather than a Shell-specific initials system.

Taskbar presentation is one deterministic projection of existing authorities rather than a lifecycle store. Native pinned/running/active state is derived from current Process and Windowing snapshots; canonical focus comes only from `WindowManager.focusSnapshot()` and never from z-order. Transient launch state may reflect an in-progress Shell action; Element running state comes from `NeutronBridge`, and an unavailable runtime observation remains explicitly uncertain rather than being interpreted as stopped. The projection retains application, process, and window identity separately and does not persist a second running-app inventory.

Native taskbar entries are grouped at application/handler identity while retaining the current ordered `ProcessRecord` members as canonical member identity. A zero-member group is pinned-only, a single member keeps the direct launch/focus/minimize task-button behavior, and a multi-member group opens a bounded chooser. The chooser stores only which handler is open; its rows are re-derived from current Process/Windowing snapshots, and selecting a running member delegates to `ProcessController.focus()` so Windowing remains authoritative for restore/focus/z-order behavior. A starting sibling does not disable an already-running member group.

Taskbar context menus are presentation over those same authorities. Item/background menus use pure taskbar placement policy from the invoking DOM source and current viewport; the policy stores no browser geometry. A native `Close` is exposed only when the context resolves to one concrete canonical process and delegates to ordinary `ProcessController.close()` negotiation rather than `forceClose` or direct WindowManager mutation. Center/Left taskbar alignment is persisted through the existing Shell preference store and changes only the application-button group; tray/status placement remains independently owned by the taskbar status surface.

`/System/Start Menu` remains the durable filesystem authority for Start. Default Settings, Explorer, and Properties shortcuts are seeded directly at that Start root rather than under a managed visible `System` category. Retirement of the former managed `System` child is deliberately conservative: only the exact previously-seeded, uncustomized legacy default shape is migrated; user renames, moves, deletions, folder metadata, or extra content prevent migration and are preserved.

The native registry is also allowed to contain `runtimeOnly` process-host definitions. Those definitions stay available to Process and association opening, but Start default seeding and the direct native-application Search inventory project only user-launchable definitions (`runtimeOnly !== true`). When a previously managed Start seed later becomes runtime-only, reconciliation retires only the exact ledger-backed default entry whose canonical folder/name, shortcut metadata, and empty content still prove managed ownership; renamed, moved, deleted, metadata/content-customized, and user-created shortcuts are preserved. Shell does not infer this distinction from handler names or create a parallel application catalog.

## Refactor direction

The intended composition boundary is established. Future work should preserve it rather than introducing another root or moving focused state machines back into `Shell.tsx`.

Keep deterministic Shell policy in focused production models/controllers, rendered surface state in explicit surface adapters, and browser event translation at the React boundary. Start/Search/taskbar inventories continue to derive from shared authorities rather than introducing Shell-owned application truth. Preference persistence remains behind the approved filesystem-backed store. Treat unavailable/uncertain external runtime information as uncertainty rather than inventing stronger Kernel knowledge.

Do not create `Shell2`, duplicate Process/Windowing/Search/taskbar state, or a generic global-state framework merely to reduce file size. New Shell features should extend the focused authority or rendered surface that actually owns the behavior.

Feature-completeness work should use mature desktop conventions for discoverability and keyboard/pointer behavior while preserving these authority boundaries.

## Testing

Use fast tests for Shell coordination policy, taskbar projection/actions/menu policy, pin/preferences semantics, canonical Search classification/query ordering plus deterministic Search surface state, Start reconciliation/models, calendar, click-away/context decisions, subscription invalidation, canonical filesystem activation adapters, and shared presentation adapters. Use RTL for the composed rendered surfaces and for Search query/category/result semantics and keyboard/focus behavior that does not depend on browser layout. Use the shared headless Plasmon environment for cross-authority activation semantics. Use real-browser tests for measured Search popup geometry/containment/internal scrolling, global keyboard shortcuts, focus behavior that Happy DOM cannot model, flyout/context-menu pointer routing, taskbar visible state, lifecycle events, and other DOM-dependent behavior. Installed Neutron checks are appropriate when the claim specifically involves a real Kernel application/tile; packaged-browser coverage is required for Plasmon-owned asset mount behavior.
