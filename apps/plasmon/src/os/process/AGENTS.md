# Native process agent instructions

## Authority

`process/**` owns Plasmon-local native application registration, process records, lifecycle, lazy host loading, and synchronization with the public window manager.

## Rules

- Native process identity is distinct from Neutron AppScope/Element, logical resource/Atom, filesystem node, and window identity.
- Real Neutron applications remain Kernel-owned and must not be represented as local native process records merely for UI convenience.
- Respect application lifecycle metadata such as singleton versus multi-instance behavior through the controller.
- Ordinary close is Process lifecycle authority: application concerns may allow, prevent, or defer it, while application-specific save/document decisions remain outside Process.
- Deferred ordinary closes must be completed or cancelled through the exact close request issued by Process; repeated ordinary close requests must not bypass a pending decision.
- `forceClose()` is an explicit lifecycle bypass for teardown/recovery and must not be substituted for ordinary UI close.
- Native window close controls must route through ordinary Process close negotiation. Direct `WindowManager.close()` is lower-level window-state teardown, not an ordinary application close request.
- Process close and external window disappearance must converge without leaked process records or registered close handlers.
- Process metadata/lifecycle changes must notify subscribers so consumers can derive current state rather than keeping shadow copies.
- Window geometry/chrome/z-order remain windowing responsibilities; coordinate only through public process/window contracts.
- Runtime hosts may use the native process/window machinery without changing their higher-level product identity.

## Refactor direction

Keep process policy in controller/store/registry production code and React hosting thin. Do not put lifecycle rules into Shell/taskbar or individual apps as a workaround.

## Validation

Cover lifecycle creation/reuse/cleanup, target/title changes, subscriptions, ordinary allow/prevent/defer close behavior, deferred completion/cancellation, explicit forced close, window-close synchronization, startup failures, defensive snapshots, and loader retry/cache behavior. Add browser coverage only for user-visible focus/window integration that cannot be established through controller tests.
