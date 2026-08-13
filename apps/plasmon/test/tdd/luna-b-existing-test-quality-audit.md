# Luna-B existing Shell / Windowing test-quality audit

Audit scope: active `src/os/shell/**`, `src/os/windowing/**`, taskbar-related RTL/headless tests, and r2 red staging. No tests owned by another implementation were rewritten.

| finding | evidence / risk | disposition | future owner |
|---|---|---|---|
| source-shape assertions | visual/refactor guard tests inspect imports/selectors where boundary policy is the claim | retain only explicit refactor guards; do not use as product RED | Testing Lead / #201 |
| CSS class assertions | current taskbar RTL uses accessible names plus environment state; class coupling is avoidable | model tests remain authority; classes only where visual state is contract | #198 |
| arbitrary pixels | `contextPosition` uses 8px/230px/180px and Shell CSS has fixed sizes without DOMRect proof | #183 browser gate must compare source-adjacent, viewport-contained rectangles with tolerance | Shell implementor |
| “geometry” without rectangles | existing manager tests prove numeric geometry; browser smoke proves snap attributes but not pointer-relative continuity | add #43/#177 browser specs; do not call model-only proof browser geometry | #199 / Testing |
| “stacking” without second participant | model z tests include another window; avoid one-window z assertions | future browser tests need real overlapping participants | #199 |
| swallowed catches | Shell/Neutron uses bounded `.catch(() => load(true))` and preference save reports errors; some cleanup catches intentionally preserve primary error | audit each catch for visible/observable failure; do not blanket-remove defensive cleanup | Shell/Testing |
| arbitrary sleeps | no new B gate uses sleep; existing browser lane should use semantic waits/health baseline | keep explicit waitFor/event completion | Testing Lead |
| fake Process/WindowManager | existing subsystem tests use narrow fakes for contract tests; shared headless uses production graph | do not add feature-local policy fakes; red gates #117/#184 use shared graph | all implementors |
| projection policy copied in tests | #118 gate calls real `deriveTaskbarEntries`; truth table documents expected projection without reimplementing it | retain pure assertion over production model | #198 |
| browser duplication of pure transitions | #43/#177 docs separate manager from DOM; no Playwright re-test of pure snap geometry | browser only pointer/rect/cleanup | #199 |
| browser-health baseline | Browser health harness and #187 smoke are integrated; B browser execution unavailable for the final closeout | final browser packets must fail unexpected console/page/worker errors | Testing Lead |
| hidden localStorage authority | Shell preferences use filesystem metadata; tests explicitly assert no localStorage requirement | #117 must follow same boundary; never introduce foreground storage | Windowing/Integration |
| stale r1 prototype text | `gui2`/legacy docs remain tracked but active entrypoint is `os/PlasmonOS.tsx`; #25/#26 are Lane-D ownership | no broad delete in B | Lane D / #201 |
| raw runtime status | taskbar model removes raw `yes/no/unknown`, but tray text still exposes it | #72 is taskbar-button green; Search/tray presentation remains dependency work (#90/#174) | Shell implementor |
| setup-crash risk in red tests | initial #91 UI attempt waited for a transient status and timed out; replaced with deterministic headless cap assertion | only executed assertion failures are promoted | Luna-B |

## Baseline observations

Focused current production tests passed: `bun test apps/plasmon/src/os/shell/taskbarPresentation.test.ts apps/plasmon/src/os/shell/shell.test.ts apps/plasmon/src/os/windowing/NativeWindowManager.test.ts apps/plasmon/src/os/windowing/snap.test.ts` (38 pass, 0 fail). Intentionally red tests are hidden under `.red` and excluded from ordinary discovery.
