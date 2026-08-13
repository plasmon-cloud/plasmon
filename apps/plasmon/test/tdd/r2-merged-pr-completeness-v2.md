# r2 merged PR completeness / promotion audit v2

Integrated target observed: `f4ac3b4c`. This pass traces merged implementation provenance to ordinary tests and browser/package destinations; merge status alone is not acceptance.

## Current r2 wave

| PR | Issue/scope | integrated proof | verdict |
|---|---|---|---|
| #209 | #186 retained-profile persistence | `test/e2e/plasmon-persistence.spec.ts`, dedicated CI; closes tile, reloads page, closes/relaunches Chromium same profile, checks NodeId/content/origin | PROMOTED EXACTLY; fresh local execution not available |
| #207 | #189 classifier seam | classifier tests plus FileManager/Search/Text/Photos/Video consumer tests | PROMOTED STRONGER EQUIVALENT |
| #206 | #170 Review first-demo polish | Review ordinary tests/e2e and Plasmon Review installed specialist | PROMOTED; Review CI owns deeper app workflow |
| #205 | #192 placement controller | controller/layout tests plus packaged placement adapter in merged history | PROMOTED; #172 composed staging packet needs integrated rerun |
| #188 | #187 guard suite / #167 harness integration | headless refactor guards, RTL smoke, packaged smoke, health policy/docs | PROMOTED INFRASTRUCTURE; allowances and #107 report remain |
| #168 | #167 harness/demo | shared renderer/environment, manifest harness, RTL tests | PROMOTED EXACTLY |

## Merged prerequisite and r2-relevant PRs

| PR | scope | durable destination / evidence | independent verdict |
|---|---|---|---|
| #37 | #29 remove hackathon seed | normal boot/demo fixture tests; `src/index.tsx` no hackathon import | GREEN |
| #36 | #30 headless environment | `test/headlessEnvironment.ts` and composed tests | GREEN |
| #55 | #33 packaged Playwright lane | smoke/specialist scripts + CI | GREEN infrastructure |
| #76 | #31 FileManager open | activation/cross-surface/refactor tests | GREEN |
| #74 | #32 Start/Search open | shell activation/cross-surface/refactor tests | GREEN |
| #102 | #40 Delete→Trash | FileManager delete/Trash lifecycle tests | GREEN |
| #69/#130 | #41/#42 close negotiation/dirty docs | process/documentClose tests + golden path | GREEN |
| #73/#129 | #45/#77 Recycle Bin/lifecycle | native RecycleBin model + Trash lifecycle + golden path launch/render | #45 GREEN; #77 closure evidence |
| #142 | #48 EmulatorJS | runtime tests, package tests, `plasmon-emulatorjs-proof.spec.ts` | PACKAGED BOUNDARY; browser proof required |
| #147 | #49 projection classification | shell projection tests | GREEN |
| #68 | #57 Program Files | Program Files tests/package paths | GREEN |
| #154 | #62 MRU | `src/os/windowing/mru.test.ts` | GREEN |
| #136 | #70 cross-surface open | `resourceOpenCrossSurface.test.ts` | GREEN |
| #104/#103 | #38/#58/#80 integration sweep | Sharing provider/backend docs/tests; Review package/tests/e2e; OpenService composition | #38 narrow boundary accepted; #58 fully implemented; #80 GREEN |
| #84 | #46 uninstall audit | `src/os/neutron/README.md` and architecture docs document Kernel-only uninstall and missing app-facing request | CLOSURE AUDIT COMPLETE / external follow-up |
| #148 | #87 Start System retirement | gate3 + migration tests | GREEN |
| #160 | #88 runtime-only hosts | `runtimeOnlyInventory.test.ts`, shell docs; PR body reports exact-head packaged rerun | GREEN core; packaged visibility evidence in PR |
| #162 | #90 Neutron Search presentation | shell projection tests and docs | GREEN core; GitHub still open |
| #131 | #67/#89/#113/#114 Monaco/runtime | package graph, Monaco adapter and specialist browser tests | packaged/runtime evidence exists, but #89 canonical Program Files worker path remains not implemented |
| #159 | #95 selected label | `desktop-label.test.tsx`, golden path bounds | GREEN; separate from #191 |
| #157 | #108 Explorer navigation | `explorer/navigation.test.ts` | core green; Issue-specific packaged Back proof absent |
| #150 | #109/#111 pin/visual | Visual component/taskbar tests | #109 green; #111 broader convergence incomplete |
| #151 | #110 hidden preference | preference/reconstruction tests | GREEN core; browser proof not fresh |
| #146 | #117 placement persistence-related window behavior | WindowManager geometry tests | deterministic scope only; persistence claim remains separate |
| #139 | #72 taskbar state | taskbar presentation/shell tests | GREEN implemented scope |
| #149 | #44 Create Shortcut | primitive/FileManager tests | GREEN |
| #163 | #121 fixture | demo fixture/package/runtime tests | package/browser boundary; current explicit fixture specs exist |
| #158/#156 | #155 Review deployment/package identity | manifest and Review packaged fixture | superseded predecessor; use #167/#170 evidence |
| #105 | integration CI repair | packaged Plasmon/Review lane repair, no product acceptance itself | infrastructure prerequisite |

## Findings

1. **#58 was missed by the prior checkpoint.** PR #101 was merged through integration PR #104. `apps/review/test/engine.test.ts`, persistence/markdown/validation tests, and `apps/review/e2e/review.spec.ts` cover logical Atom identity, typed semantic commands, one revision per command, idempotence/concurrency conflict, history/restore, persistence/reopen, and Markdown/TODO portability. This is not a pending C RED; it is integrated standalone acceptance, with Review CI as the browser/package authority.
2. **#38 is not UI TDD.** Its provider/storage and safe share/revoke subset is integrated through PR #104; `importShare()` remains deliberately fail-closed because MTN lease-bound provider calls are absent. The remaining work is backend/package/documentation/review-packet bookkeeping and future #125/#127, not a fabricated Plasmon UI gate.
3. **#45 has a packaged launch/render assertion inside the golden path,** even though no dedicated Recycle Bin spec exists. Do not call it unimplemented; distinguish launch/render from complete manual delete/restore visual review.
4. **#108 is core-green but not complete:** the model test is ordinary and strong, while the Issue explicitly asks for packaged Back-button proof not included in the current specialist command.
5. **#48 is implemented, not merely a future packet:** the actual runtime/package/browser paths exist. Its remaining classification is packaged evidence, not missing production routing.
6. **#89 is not green merely because #131 packages Monaco workers:** current `build.ts` still emits `dist/web/monaco-workers/*`, while the Issue requires `/System/Program Files/MonacoEditor`; this is a genuine implementation gap.

No merged PR in this table is marked fully closed solely from its merge commit; each verdict identifies the durable layer and remaining boundary.
