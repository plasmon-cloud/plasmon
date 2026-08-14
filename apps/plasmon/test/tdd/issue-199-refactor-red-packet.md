# #199 refactor-specific RED packet

**Status: PACKET READY — HEADLESS RED + BROWSER BOUNDARY inheritance**

Prepared against current `origin/release/0.1.0-r2` (`82f176a`). This packet consolidates the existing #43, #117, #177, WindowManager, and browser-geometry evidence. It does not add a second WindowManager or fake DOM geometry.

## Authority fence

| concern | canonical authority | refactor disposition |
|---|---|---|
| window identity, geometry, constraints, z-order, focus/MRU | `WindowManager` / `NativeWindowManager` | **PRESERVE**; the manager remains sole authority |
| snap/restore/maximize/minimize transitions | `WindowManager` plus pure `geometry.ts` | **PRESERVE** manager semantics; browser adapter only forwards intent |
| process/window lifecycle close request | `ProcessController` | **PRESERVE**; NativeWindow close is a request, not direct teardown |
| pointer capture, titlebar drag, resize, edge detection | `NativeWindow`/interaction browser adapter | **CHANGE** into focused humble adapters; no policy duplication |
| chrome icon/fallback/sizing presentation | shared Visual/resource presentation | **CHANGE** consumption where shared semantics exist; preserve identity |
| placement persistence | #117's Fs-backed Windowing composition | **UNSPECIFIED for #199** and out of scope; #199 must not absorb or replace #117 |
| real DOM rects, viewport reachability, focus/pointer behavior | packaged Playwright/browser | **CHANGE** only with real browser evidence |

## Existing executable evidence

| contract | existing gate | current result | packet use |
|---|---|---|---|
| manager focus/MRU, geometry snapshots, constraints, snap/restore | `src/os/windowing/NativeWindowManager.test.ts`, `snap.test.ts`, geometry tests | green | permanent manager guard; never move policy to React |
| cross-session placement persistence | `.red/issue-117.red.test.ts` | RED: reopen returns `(64,48)`, expected `(311,177)` | remains a separate #117 RED and persistence guard |
| bounded repeated default placement | `.red/issue-177.red.test.ts` | RED: repeated placement reaches `(1208,688)` instead of wrapping | direct #199 geometry regression guard |
| snap-out pointer-relative continuity | `issue-43-browser-adoption.md`, `issue-43-browser-pointer-continuity.md` | browser boundary, not locally executed | packaged Playwright adoption gate |
| current browser window placement/reachability | `issue-177-browser-adoption.md` | browser boundary, not locally executed | DOMRect/titlebar/control reachability gate |
| close negotiation and deferred dirty close | Process/document close tests; Windowing close contract | green | preserve callback authority; no direct WindowManager close from chrome |

Focused deterministic RED commands:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-117.red.test.ts \
  ./apps/plasmon/test/tdd/.red/issue-177.red.test.ts
```

Current failures are exact: placement persistence is absent and repeated placement clamps at the bottom-right instead of applying bounded wrap/restart. They are not permission to put placement state in React.

## PRESERVE / CHANGE / UNSPECIFIED

### PRESERVE

- detached `WindowState` snapshots and manager subscriptions/cleanup;
- manager-owned focus/MRU independent of z-order;
- minimize/restore/maximize/snap semantics and saved floating geometry;
- titlebar/control reachability constraints as manager/browser contracts;
- Process-mediated close negotiation and dirty-close veto/defer;
- native application/resource identity and shared chrome presentation semantics.

### CHANGE

- split broad `NativeWindow` rendering and pointer/resize/snap event orchestration into focused browser adapters;
- preserve pointer-to-window grab offset through snap-out and ordinary drag;
- make browser adapter cleanup explicit for pointer cancel/lost capture/iframe suppression;
- consume bounded default-placement policy from Windowing and make repeated placement behavior deterministic;
- remove superseded duplicate interaction/chrome paths after migration;
- add focused Bun tests for any newly extracted deterministic geometry policy and Playwright coverage for real pointer/DOM behavior.

### UNSPECIFIED — do not guess

- exact React component names or file split;
- animation implementation and screenshot pixels;
- placement persistence record/schema (owned by #117);
- quarter snapping, multi-monitor/workspace policy;
- browser behavior that Happy DOM cannot faithfully model.

## Browser adoption contract

Adopt the existing #43 and #177 blocks into the packaged Explorer flow rather than creating a second browser harness. The final #199 browser gate must:

- install/boot through the existing packaged environment and strict browser-health listener;
- record pre/post `DOMRect`, viewport bounds, pointer coordinates, titlebar grab offset, snap state, and cleanup;
- prove repeated left/right snap-out, pointer-cancel/lost-capture cleanup, resize/reachability, and narrow/short viewport containment;
- prove titlebar/control reachability and actual focus/activation, not merely a manager state flag;
- close all created windows/processes and leave no browser listener or pointer capture behind.

Use:

```sh
npx playwright test test/e2e/plasmon-golden-path.spec.ts --project=chromium --retries=0
```

No local browser execution is claimed by this packet. A browser pass is required before claiming the adapter/chrome acceptance green.

## Promotion / completion gates

1. Keep all manager geometry/snap/focus tests green.
2. Preserve #117 as a separate persistence RED until its own implementation lands; do not make #199's adapter own durable geometry.
3. Turn #177 deterministic placement RED green through WindowManager-owned policy.
4. Adopt and execute #43/#177 browser blocks with strict health, real DOMRects, pointer-relative offsets, viewport containment, and teardown.
5. Run `npm --workspace neutron-plasmon test`; run packaged Playwright for the browser boundary.
6. Remove superseded adapter/chrome code before Ready; no `NativeWindow2`, duplicate geometry store, or React geometry authority.

**Dependency assessment:** packet is ready. #117 persistence is an explicit guard/out-of-scope dependency, not a reason to postpone packet preparation. #43 and #177 provide the concrete behavioral gates; #187 packaged health infrastructure and #190/#111 shared presentation direction are available current-r2 inputs.
