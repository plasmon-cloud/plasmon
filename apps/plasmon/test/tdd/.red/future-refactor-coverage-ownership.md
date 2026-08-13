# Future refactor coverage ownership

| Behavior | Pure/headless already proves? | RTL needed? | Browser genuinely needed? | Package genuinely needed? | Future owner |
|---|---:|---:|---:|---:|---|
| Search limits/cancellation/classification | yes, partial | no | no | no | #193 after #174/#189 |
| Search focus/category semantics | no | yes | focus/geometry only | packaged composition | #193/#175 |
| Start reconciliation/preservation | yes | no | no | no | #169/#194 |
| Start navigation/activation semantics | activation yes | yes | geometry/focus only | composed | #194 |
| Shell flyout transitions | policy helpers yes | yes | focus/hit testing | no unless packaged | #197 |
| taskbar projection/actions | yes, partial | yes | menu geometry only | composed | #198/#183/#118 |
| pin persistence | yes | yes for labels | no | no | #109/#198 |
| Native window geometry/snap | manager/helpers yes | no | pointer/rect/capture | packaged composition | #199/#43/#177 |
| Text/Markdown document/save/close | yes | controls only | Monaco worker/focus | yes | #200/#67/#89 |
| FileManager commands/selection | yes, partial | semantic adapters | pointer rect/marquee/download | packaged only if journey | #195/#196 |
| FileManager view layout | layout helpers partial | semantics | real responsive geometry | packaged only if app path | #196/#173 |
| cleanup/import boundaries | static inspection + tsc | no | package reachability when claimed | yes for assets | #201 |

Rule: do not write Playwright for deterministic identity, persistence, matching,
selection, projection, or state transitions already proven by Bun/headless.
