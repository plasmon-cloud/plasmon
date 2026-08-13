# Shell / Windowing browser-boundary matrix

| Issue / behavior | lowest truthful layer | browser/package claim | gate/status |
|---|---|---|---|
| #43 snap geometry/state | Bun manager/pure geometry | pointer client/grab offset through snap-out | BROWSER SPEC ONLY; no independent Playwright execution |
| #63 Alt-Tab state | RTL/Windowing MRU | actual global key event and visible switcher/focus | RTL RED staged; packaged browser still required for final key behavior |
| #72 taskbar state | Bun projection | labels/visual state only manual/package glance | ALREADY GREEN deterministic; no browser claim |
| #87 Start folder reconciliation | Bun Fs/Start | visible layout manual only | ALREADY GREEN deterministic |
| #91 cap vs safety | Bun Search model | no browser needed for distinction | HEADLESS RED staged |
| #109 pin identity/presentation | Bun + RTL primitive | platform-independent icon composition/manual | ALREADY GREEN; visual manual remains |
| #111 token convergence | source/component audit + manual | actual appearance across surfaces | CLOSURE AUDIT; no source-shape RED |
| #115 command vocabulary | headless authority composition | DOM event delivery only after commands migrate | CHARACTERIZATION READY / Lane A |
| #117 placement persistence | Bun repository + manager | packaged/browser close/reopen glance | HEADLESS RED; packaged follow-up required |
| #118 grouping | Bun projection | chooser menu selection/hit testing | HEADLESS RED; RTL/browser follow-up |
| #175 Search frame | production state + browser geometry | DOMRect control stability/scrolling | WAIT FOR Luna-A packet |
| #177 default placement | Bun geometry | rendered titlebar/control reachability | HEADLESS RED; small browser spec required |
| #183 menu/Close/alignment | Bun command/prefs + RTL | source-adjacent viewport-contained menu geometry | RTL RED for Close; browser geometry not run |
| #184 TaskManager | Bun resource/projection | small UI activation proof | HEADLESS RED; UI/package follow-up |
| #185 Show Desktop | Bun command/state | taskbar context action and browser event | RTL RED; geometry not required |
| #199 adapter reconstruction | Bun geometry + Playwright | real pointer capture/CSS/resize/focus | Luna-A ownership; B supplies #43/#177 evidence |

## Browser-health rule

A parsed Playwright file is not evidence. Final browser gates must assert strict baseline health (unexpected page errors, worker/security errors, and runtime failures fail the test), compare actual rectangles/coordinates where geometry is claimed, and clean up pointer capture, timers, windows, and browser context. Browser-unavailable work is explicitly `BROWSER SPEC ONLY` or `BROWSER BLOCKED`, never verified.
