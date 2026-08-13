# Shell transient controller contract

Status: **CHARACTERIZATION READY — NO HONEST STRUCTURAL RED**. The existing
behavior can be tested without asserting future files/components, but current
RTL harness coverage is incomplete. #197 should extract behavior, not satisfy a
line-count or component-count assertion.

## Invariants

1. At most one Shell flyout is active: Start, Search, calendar, tray, or
   settings.
2. Opening a different flyout closes the prior one.
3. Re-clicking the active toggle closes it.
4. Escape closes context menu and flyout without mutating durable data.
5. Outside pointer closes Shell-owned flyouts/context menus but must not capture
   foreign Browser/Neutron surfaces.
6. Context menu takes precedence over generic shell context policy for native or
   Element task buttons.
7. Search/Start activation delegates to canonical authorities; success may close
   the flyout, failure is visible.
8. Focus return is an explicit acceptance question: characterize the active
   element before and after dismissal rather than assume browser default.
9. Native process/window focus and z-order remain Process/Windowing authority.
10. Shell preference writes remain FsService-backed and non-destructive.

## Testable lower-layer vocabulary

`shouldDismissShellFlyout`, `resolveShellContextMenuPolicy`,
`shouldDismissAfterResultActivation`, calendar helpers, taskbar model/action
helpers, and `LatestSearchController` are already pure seams. Add no duplicate
controller solely to make #197 red. The migration gate should be composed RTL
behavior over the real Shell graph and pure transition tests only for newly
accepted policy.

## Boundary failures

- FsService preference load failure => defaults plus visible notice.
- Neutron discovery failure => visible alert while Shell remains usable.
- Search source failure => Search alert; no stale activation unless accepted.
- Start reconciliation/list failure => Start alert/loading termination.
- Taskbar activation failure => action alert; Process/Windowing state remains
  canonical.
