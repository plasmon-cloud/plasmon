# #81 composed taskbar lifecycle acceptance map

| criterion | authority | observable | permanent path / Luna gate | result |
|---|---|---|---|---|
| pinned native starts pinned-only | Shell preferences + native registry | one pinned-only entry | `apps/plasmon/test/taskbarLifecycle.test.ts` (hidden `.red` provenance) | PASS |
| launch becomes running/active | Process.open + WindowManager.create/focus | active presentation | same permanent composed test | PASS |
| second process changes first to inactive | Process + Window z/focus | first running, second active | same permanent composed test | PASS |
| minimize then restore/focus | WindowManager.minimize/focus | running inactive → active | same permanent composed test | PASS |
| close removes running but keeps pin | Process.close + Shell projection | process absent, pinned-only remains | same permanent composed test | PASS |
| dirty close veto | Process close negotiation | process/window remain alive | `apps/plasmon/test/taskbarLifecycle.test.ts` plus `src/native-apps/text/documentClose.test.ts` | PASS |
| stale external window closure | WindowManager subscription → Process reconcile | Process removed; no task target | same permanent composed test | PASS |
| Element unknown | Neutron bridge observation | uncertain, not stopped | permanent `taskbarLifecycle.test.ts` + `src/os/shell/taskbarPresentation.test.ts` | PASS |
| shared production environment | `createHeadlessPlasmonEnvironment()` | real service graph, no feature fake | permanent test setup | PASS |
| CSS/visual proof excluded | Shell projection model | no class-only assertions | permanent headless destination | PASS |

Final disposition: **RECON COMPLETE — ALREADY GREEN / COMPLETE COMPOSED ACCEPTANCE**. The permanent composed regression runs on current r2 and passes 3 tests with 14 assertions. It covers the real Process/WindowManager graph, preserves authority boundaries, and adds no Playwright dependency.
