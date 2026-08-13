# Issue #118 — grouping truth table and readiness

Status: **CHARACTERIZATION READY / WAIT FOR ACCEPTED MULTI-WINDOW VOCABULARY**.
No active PR owns #118. The current Process contract exposes one optional
`windowId` per process; do not invent a multi-window process model.

| Scenario | Group identity | Children | Button behavior | Required projection |
|---|---|---|---|---|
| 1 app / 1 process / 1 window | handler/app id | one process/window | current single-click launch/focus/minimize | preserve #72 state |
| 1 app / 1 process / N windows | handler/app id | only if accepted Process/Window vocabulary can enumerate them | chooser needed | currently not representable truthfully |
| 1 app / N processes / N windows | handler/app id | each ProcessRecord + matching WindowState | one group + bounded chooser | #118 core future case |
| pinned + running | handler/app id | running children + persistent pin | one group retains pinned state | preference + Process |
| grouped + focused | handler/app id | focused child | group active; chooser identifies focused child | Windowing z/focus |
| one child closes | same group | remaining children | group remains; closed child absent | Process.close/Windowing |
| all children close | same group | none | pinned-only if pinned, otherwise removed | pin authority |
| minimized child | same group | child minimized | group remains running; selecting child restores/focuses | Windowing |
| launching | same group | starting process | bounded launching state | Process state |

## Negative cases

- Different handlers with same display name must not group.
- Same handler with distinct process IDs must not silently collapse lifecycle
  records; group children preserve IDs.
- Missing WindowState must not become focused/active.
- Element/Neutron runtime records are out of scope unless accepted Kernel
  metadata supports grouping.
- DOM order must not decide child order; use deterministic Process/Windowing
  observations.

## Test plan

Pure Bun projection tests should build ProcessRecord/WindowState fixtures through
real contract types and assert group identity, child preservation, sorting,
active/minimized state, and closure transitions. RTL should cover chooser
activation only after the accepted projection vocabulary exists. Browser is not
needed for grouping logic; use Playwright only for real menu/preview geometry.
