# Issue #183 — taskbar context/action acceptance map

Status: **BROWSER SPEC ONLY / CHARACTERIZATION READY**. #183 has no active PR.
Deterministic close/persistence semantics can be covered below browser; menu
anchoring and hit testing require real geometry.

## Canonical requirement -> authority -> observable -> layer -> evidence -> gap

| Requirement | Authority | Observable | Layer | Existing evidence | Missing |
|---|---|---|---|---|---|
| item menu adjacent to source | Shell context adapter + DOM rect | menu anchored near invoking task button | Playwright | `contextPosition` bounds menu | real source/menu rect comparison |
| background menu placement | Shell background context policy | menu anchored to pointer/taskbar background and viewport-contained | Playwright | generic context policy unit test | composed pointer journey |
| Close only when running | Process records + accepted group model | menu has Close iff canonical running target | Bun + RTL | Process contract has close negotiation | taskbar menu surface |
| Close delegates | ProcessController.close/close handler | veto/defer leaves process/window; allow removes lifecycle | Bun | Process lifecycle tests | taskbar command composition |
| Center/Left alignment | Shell preference authority | task buttons move according to accepted mode | RTL + Playwright | no current preference field | preference schema/controller + geometry |
| alignment persists | FsService-backed preferences | reload/reconstruct retains mode | Bun/RTL | preference store persistence patterns | new accepted field migration |
| pin/unpin retained | preference store/togglePinned | labels/state survive | Bun/RTL | `taskbarPinAction` and Fs tests | composed control |

## Browser geometry protocol

Capture source task/background `getBoundingClientRect()` and menu rect after
right-click. Assert adjacency using a relative distance to the source/pointer,
viewport containment, and no obstruction of the invoking task target. Do not
assert the current `230` width, `180` height, or a magic CSS top value. The
browser test starts from strict health baseline; it does not remove #190/#67
allowances outside its own surface.
