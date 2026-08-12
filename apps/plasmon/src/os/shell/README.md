# Plasmon Shell

`shell/**` owns shell-level presentation and orchestration around the central Desktop/native-window workspace: Start, Search, taskbar/tray, calendar, flyouts/context menus, pinning, and shell preferences.

Shell derives state from public authorities. Native task state comes from `ProcessController`/`WindowManager`; external application state comes from `NeutronBridge`; filesystem/search/start content comes from filesystem/shared resource services. Shell must not become a second install database, process store, filesystem, or generic resource-opening authority.

Filesystem-backed Start and Search activation delegates to the canonical `FilesystemOpenDispatcher`. Shell keeps Start-folder navigation, Search result selection, overlay dismissal, pinning, and genuinely non-filesystem native/Element actions, but does not duplicate directory/shortcut/system-app/Neutron-app/association launch policy.

## Production models

The directory already separates a number of deterministic concerns:

- `activation.ts` — thin Start/Search adapters into canonical filesystem opening;
- `model.ts` — taskbar/tray derivation and native task actions;
- `preferences.ts` — persisted shell preferences;
- `search.ts` — search/query inventory, classification, limits, and invalidation;
- `startMenu.ts` — Start inventory, reconciliation, and shortcut presentation metadata;
- `interactions.ts` — click-away/context/pin decisions;
- `subscriptions.ts` — derived-state invalidation;
- `calendar.ts` — date/calendar calculations.

`Shell.tsx` composes those models with DOM/browser lifecycle, flyouts, keyboard/pointer events, and rendering.

## Refactor direction

`Shell.tsx` still coordinates many independent state machines. Continue moving Start/Search/taskbar/flyout action logic into production controllers/models where it can be tested without rendering the entire shell. Keep React focused on composition and browser events.

Start/Search/taskbar inventories should continue to derive from shared authorities rather than introducing shell-owned application truth. Preference persistence remains behind the approved filesystem-backed store. Treat unavailable/uncertain external runtime information as uncertainty rather than inventing stronger Kernel knowledge.

Feature-completeness work should use mature desktop conventions for discoverability and keyboard/pointer behavior while preserving these authority boundaries.

## Testing

Use fast tests for task derivation/actions, pin/preferences semantics, search classification/query ordering, Start reconciliation/models, calendar, click-away/context decisions, subscription invalidation, and canonical filesystem activation adapters. Use the shared headless Plasmon environment for cross-authority activation semantics. Use real-browser tests for global keyboard shortcuts, focus movement, flyout/context-menu pointer routing, taskbar visible state, lifecycle events, and other DOM-dependent behavior. Installed Neutron checks are appropriate when the claim specifically involves a real Kernel application/tile.