# Native process runtime

`process/**` implements Plasmon-local native application registration, process lifecycle, lazy component hosting, and synchronization with the window manager.

A native application definition, a running process record, a window, a filesystem resource, a logical Atom, and a Neutron Element/AppScope are separate identities.

## Architecture

- `registry.ts` stores native application metadata and lazy loaders.
- `controller.ts` owns process creation, singleton/multi-instance behavior, target/title updates, focus delegation, close lifecycle, and reconciliation when windows disappear.
- `store.ts` owns process records/subscriptions.
- `NativeProcessHost.tsx` is the React adapter that subscribes to process state and mounts the registered lazy component.

The controller delegates geometry/chrome/focus mechanics to `WindowManager`; the window manager does not become process storage. Real Neutron Elements remain outside this process model.

## Close lifecycle

`ProcessController.close()` is the ordinary lifecycle close path. With no registered concern it retains immediate teardown behavior. A native application may register one generic close handler for its process; the handler may allow the close, prevent it, or defer it while application-owned state is resolved. A deferred request carries `complete()` and `cancel()` callbacks so the same close attempt can later finish or be abandoned without moving save/document semantics into Process.

`ProcessController.forceClose()` is the explicit teardown bypass for shutdown/error-recovery style callers. It must not be used as an ordinary UI close shortcut.

The rendered native-window close control routes through the process ordinary-close path. A direct `WindowManager.close()` is a lower-level window-state teardown, not an application lifecycle request; external disappearance is reconciled as authoritative cleanup because Process cannot negotiate after the window has already been destroyed.

## Refactor direction

Keep lifecycle state and decisions in the controller/store/registry so Shell and apps can be tested without rendering React. Keep the React host thin: loading/mounting an app should not become the place where process policy accumulates.

If lifecycle semantics expand (activation, recovery, multi-window ownership), evolve the production controller/contracts deliberately rather than encoding them as taskbar or app-specific event handlers.

## Testing

Use fast controller/registry/store tests for creation, singleton/multi-instance behavior, target/title updates, startup failure cleanup, focus delegation, ordinary/deferred/forced close behavior, window-close routing, subscriptions, and loader retry/cache behavior. Browser tests are only needed when the claim depends on visible focus/window/taskbar behavior rather than controller state.
