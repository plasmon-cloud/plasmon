# Native process runtime

This directory implements the Plasmon-native application/process runtime behind the frozen OS contracts.

## Invariants

- `NativeAppDefinition` remains framework-neutral. React component loaders live only in this subsystem's runtime registry/host adapter.
- Native app definition, process instance, and window instance are separate identities.
- Process IDs are monotonic per application (`<appId>#<n>` by default) and are not reused while the controller is alive.
- A singleton application reuses its existing non-closing process, updates its `OpenTarget`, and focuses its existing window.
- A multi-instance application creates a new process/window for every successful open.
- `OpenTarget.nodeId` remains the stable resource identity; this subsystem never converts it to a filesystem path.
- `WindowManager` is consumed only through its frozen contract. This subsystem does not own geometry, chrome, z-order, drag, resize, minimize, or maximize behavior.
- Window creation failure removes the temporary `starting` process and returns `null`.
- Closing through `ProcessController` transitions through `closing`, closes the associated window, then removes the record. If a window disappears through `WindowManager`, subscription reconciliation removes its running process.
- `list()` returns snapshots; subscribers are notified only by the process store, and no external consumer needs the internal store.
- Real Neutron Elements are not represented as native `ProcessRecord`s.

## React hosting

`NativeApplicationRegistry.registerWithLoader()` or `setLoader()` associates framework-neutral metadata with a lazy React loader without changing the public application contract. `NativeProcessHost` subscribes to `ProcessController`, lazy-loads the registered component, and passes the current process ID/target plus `FsService` and `ProcessController` through the narrow React adapter props defined in `runtime.ts`.

Loader promises are cached after success. A rejected load is evicted so a later mount/open can retry.

## Integration

Composition code should expose `NativeApplicationRegistry` through the `NativeAppRegistry` contract and `NativeProcessController` through the `ProcessController` contract. Only the composition/native-host layer needs the React-specific loader APIs.

Tests in `process.test.ts` cover creation, singleton reuse/focus, multi-instance behavior, close lifecycle (including external window closure), title/target updates, subscriptions, WindowManager calls, failed startup cleanup, and lazy loader caching/retry.
