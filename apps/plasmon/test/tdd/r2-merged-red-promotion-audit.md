# r2 merged implementation promotion audit

Observed integrated release: `f4ac3b4c`.

| Issue / PR | integrated evidence inspected | durable strength | result |
|---|---|---|---|
| #167 / #188 | `headlessEnvironment.ts`, `renderPlasmon.tsx`, RTL smoke, TESTING.md, manifest harness | production-backed composition, bounded RTL, package policy and gap vocabulary | FULLY PROMOTED |
| #170 / #206 | Review ordinary tests, presentation tests and packaged Review workflow | readable controls, Atom identity and installed workflow | PROMOTED; browser result remains distinct from headless |
| #186 / #209 | `test/e2e/plasmon-persistence.spec.ts`, persistence workflow | retained profile, close/reopen, reload, Chromium relaunch, NodeId and bytes | FULLY PROMOTED; no PocketIC reinstall in probe |
| #187 / #188 | `test/refactorGuards.test.ts`, RTL smoke, packaged smoke, `REFACTOR_GUARDS.md` | assembled boot/open/authority/health/gross geometry | PROMOTED; temporary allowances remain tracked |
| #189 / #207 | classifier implementation and consumer regressions | canonical classification and MIME precedence through consumers | FULLY PROMOTED |
| #192 / #205 | placement controller, desktop layout tests, packaged adapter references | incumbent positions, deterministic allocation and drag adapter | PROMOTED; exact packaged execution not rerun here |
| #25 / #142 | merged cleanup changes | implementation exists | acceptance/closure not proven by merge alone |
| #38 / #39/#104/#160 | sharing provider and persistence tests | substantial provider contract | Issue's blocked label and Kernel capability boundary need coordinator closure |
| #43 / #75 | snap tests | deterministic edge snap/restore | FULLY PROMOTED |
| #44 / #149 | shortcut primitive and FileManager tests | identity/collision/rename/create eligibility | FULLY PROMOTED |
| #64 / #103 | js-dos model/runtime tests | filesystem resource and runtime selection | headless promoted; packaged sandbox remains #202 |
| #67/#89/#113 / #131 | Monaco adapter/package tests | mature engine and workers in build graph | deterministic guard promoted; packaged worker execution remains browser-only |
| #72 / #139 | taskbar presentation tests | pinned/running/active/launching projection | FULLY PROMOTED for implemented scope |
| #82 / #133 | managed-root tests | idempotent roots and user state | FULLY PROMOTED |
| #87 / #148 | Start migration tests | retirement/migration and customization preservation | FULLY PROMOTED |
| #95 / #159 | Desktop label tests | selected/focused overlay, placement unchanged | FULLY PROMOTED; not #191 editor geometry |
| #107 / #152 | review baseline/smoke artifacts | baseline and packaged gate infrastructure | PROMOTED infrastructure; “latest review” execution not independently rerun |
| #109/#111 / #150 | pin and visual convergence tests | shared pin presentation | #109 promoted; #111 broader target remains incomplete |
| #110 / #151 | filesystem preference tests | persisted hidden preference and canonical listing | FULLY PROMOTED |
| #117 / #146 | WindowManager state tests | geometry authority and placement state | promoted deterministic scope; retained browser persistence not shown |
| #121 / #163 | game fixture tests | explicit package fixture, normal boot unchanged, association open | FULLY PROMOTED; fixture is intentionally separate from #181 |
| #155 / #156/#158 | Review demo manifest/package work | explicit installation fixture | SUPERSEDED by #167/#181 distinction; do not use as #181 proof |

## #187 criterion audit

| criterion | permanent test/doc | state / allowance / owner |
|---|---|---|
| assembled boot | `test/refactorGuards.test.ts` assembled composition | green |
| canonical open | `refactorGuards.test.ts`, `resourceOpenCrossSurface.test.ts` | green |
| `.sys` | refactor guard + bootstrap tests | green |
| `.neutron` | Review integration + projection tests | green |
| NodeId lifecycle | refactor guard lifecycle test | green |
| Process/Window/taskbar | refactor guard + RTL smoke | green |
| Start/Search projection | refactor guard + projection tests | green |
| Desktop/FileManager shared resource | cross-surface and FileManager tests | green |
| persistence/recomposition | `managedRootBootstrap.test.ts`, #186 packaged test | green at separate layers |
| strict browser health | `browserHealthHarness.test.ts`, `plasmon-browser-health.ts` | green policy; owned allowances still active |
| packaged common path | packaged refactor smoke workflow | packaged proof exists; not locally executed in this audit |
| geometry sanity | packaged smoke, #192 tests | gross geometry green; #175 exact geometry remains owned |
| visual spike | `REFACTOR_GUARDS.md` records deterministic spike and retirement | documentation complete; no screenshot gate by design |
| durable contract docs | `REFACTOR_GUARDS.md`, TESTING.md | green |

## Conclusions

Merged PRs #188/#205/#206/#207/#209 are not automatically closure-ready for every linked Issue. The remaining integrated promotion concerns are browser allowances for #190/#67/#200/#202 and exact geometry #175; the bounded exact-head audit now accepts active #51/#65 promotion, pending their normal merge/release ancestry. No product code was changed by this audit.
