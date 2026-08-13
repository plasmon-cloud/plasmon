# #81 composed taskbar lifecycle acceptance map

| criterion | authority | observable | permanent path / Luna gate | result |
|---|---|---|---|---|
| pinned native starts pinned-only | Shell preferences + native registry | one pinned-only entry | `issue-81.composed.red.test.ts`, future `src/os/shell/taskbarLifecycle.test.ts` | PASS |
| launch becomes running/active | Process.open + WindowManager.create/focus | active presentation | same | PASS |
| second process changes first to inactive | Process + Window z/focus | first running, second active | same | PASS |
| minimize then restore/focus | WindowManager.minimize/focus | running inactive → active | same | PASS |
| close removes running but keeps pin | Process.close + Shell projection | process absent, pinned-only remains | same | PASS |
| dirty close veto | Process close negotiation | process/window remain alive | same | PASS with synthetic registered close concern; Text/Markdown model proof in `documentClose.test.ts` |
| stale external window closure | WindowManager subscription → Process reconcile | Process removed; no task target | same | PASS |
| Element unknown | Neutron bridge observation | uncertain, not stopped | `taskbarPresentation.test.ts` + composed gate | PASS |
| shared production environment | `createHeadlessPlasmonEnvironment()` | real service graph, no feature fake | gate setup | PASS |
| CSS/visual proof excluded | Shell projection model | no class-only assertions | permanent headless destination | PASS |

The gate is a passing characterization because current production already satisfies this issue's semantic acceptance. It is not a new product RED. Promotion gap: move the gate into ordinary discovery as a permanent composed regression when Lane-D owns the integration packet.
