# Shell agent instructions

## Authority

Shell owns Start/Search presentation, taskbar/tray, calendar, flyouts/context menus, pinning, shell preferences, and shell-level navigation/orchestration. It does not own generic filesystem opening, process storage, Windowing state, filesystem identity, or Neutron installation/runtime authority.

## Rules

- `Shell.tsx` is the Shell composition root. Do not move surface-specific rendered state or deterministic coordination policy back into it when a focused surface/controller already owns that concern.
- `shell-coordination.ts` owns deterministic one-flyout/context/taskbar-group transient coordination. It is Shell-global presentation policy only; it is not Process, Windowing, Search, Start, or persistence state.
- `ShellSurfaces.tsx` contains focused rendered adapters for taskbar, tray, calendar, settings, context menus, and Shell notices. They consume explicit props and translate rendered intent; they do not create parallel domain authorities.
- `shell-runtime.ts` observes canonical Process/WindowManager/Neutron state for React composition. Observation must not become a second lifecycle or installation database.
- Search query/category/request lifecycle remains in the dedicated Search controller/surface seam. Do not introduce another Search controller in Shell composition work.
- Start inventory/reconciliation remains in the existing Start models/controller/surface seam.
- Derive native tasks from process/window authorities rather than maintaining shadow process state.
- Derive external application state from `NeutronBridge`; preserve uncertainty when the Kernel cannot authoritatively answer.
- Start/Search inventories consume shared filesystem/application metadata rather than hard-coded parallel application catalogs.
- Opening from Shell delegates through shared opening/filesystem/association/Neutron services.
- Preferences persist through the approved preference store, not ad hoc foreground browser storage.
- Reuse shared resource visuals and semantic classification rather than shell-specific filename/type inference.
- Subscriptions/invalidation must keep derived task/search/start state current without requiring incidental user interaction.

Specific paths, suffix display bugs, individual runtime handlers, visual color fixes, or one-off Start entries belong in Issues/tests rather than this generic file.

## Refactor direction

Keep `Shell.tsx` primarily composition/orchestration. Deterministic Shell-global policy belongs in focused production models/controllers with Bun coverage; rendered surface behavior belongs in focused adapters with RTL coverage. Do not create `Shell2`, a second taskbar model, a second Search controller, or a generic global-state framework to reduce line count.

## Validation

Keep deterministic model/preference/search/start/subscription/coordination tests. Use RTL for rendered semantic adapters. Use real-browser tests only for keyboard/focus/click-away/context-menu/taskbar behavior that requires actual browser ownership, and installed Neutron verification only where Kernel behavior is part of the claim.
