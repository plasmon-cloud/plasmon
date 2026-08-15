# R2 42-entry TDD promotion audit

Audit timestamp: 2026-08-15T00:43Z. Integrated release inspected: `origin/release/0.1.0-r2` at `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`. The live queue contains 42 unique entries. This matrix distinguishes the queue's finalized RED disposition from actual product-train promotion.

**Intentional RED means an executable, behavior-bearing failing gate—not a browser-only packet, characterization, source-shape proposal, or a missing product/test seam.** Current-r2 GREEN requires an ordinary/permanent production test or adopted equivalent in the release tree and merged implementation evidence. Issue closure or packet finalization alone is not promotion evidence.

| Issue | Luna result | Intentional RED? | Implementation PR / disposition | Permanent regression exists? | Green in current r2? | Final state |
|---|---|---|---|---|---|---|
| #44 | A: canonical shortcut primitive already green | No; green characterization | No PR; canonical shortcut/open tests retained | Yes — `src/os/file-manager/create-shortcut.test.tsx`, filesystem/open guards | Yes | ALREADY GREEN |
| #51 | A: RED consumed | Yes — 2 staging files / 3 cases | PR #210 merged; `send-to-desktop.test.ts` and RTL #51 adopted | Yes — source + `apps/plasmon/test/rtl/issue-51-send-to-desktop.test.tsx` | Yes | DONE |
| #65 | A: RED consumed | Yes — 1 staging file / 3 cases | PR #208 merged; operation-state and RTL tests adopted | Yes — `operation-state.test.ts`, `issue-65-operation-progress.test.tsx` | Yes | DONE |
| #66 | A: browser boundary packet | No executable RED in canonical staging | No implementation PR; browser boundary disposition | No permanent product regression yet | Not established; browser evidence remains separate | DEFERRED |
| #86 | A: browser boundary packet | No executable RED in canonical staging | No implementation PR; browser boundary disposition | No permanent product regression yet | Not established; browser evidence remains separate | DEFERRED |
| #92 | A: RED consumed | Yes — 1 staging file / 1 case | PR #223 merged; move-operation/presentation/RTL tests adopted | Yes — `move-operation.test.ts`, `operation-presentation.test.ts`, `test/rtl/issue-92.test.tsx` | Yes | DONE |
| #93 | A: browser geometry packet | No executable RED; deterministic core is green | No implementation PR; packaged geometry boundary | Related Visual tests exist, but no exact Issue regression | No exact browser promotion | DEFERRED |
| #94 | A: video thumbnail boundary | No; no truthful production media seam for a corrective RED | No PR; lifecycle/eligibility contract only | No | No; missing production seam | NO CORRECTIVE RED |
| #110 | A: deterministic preference green / browser remainder | No executable RED | No PR; browser-boundary disposition | Preference/visibility tests exist; packaged persistence proof remains | Core yes; browser remainder unproven | DEFERRED |
| #115 | A: characterization only | No valid corrective RED | No implementation required; delegated Open/Trash/shortcut authorities retained | Existing delegated tests; no new command-layer regression | Existing behavior yes | NO CORRECTIVE RED |
| #192 | A: RED consumed | Yes — 1 staging file / 3 cases | PR #205 merged; permanent Desktop placement/e2e guards adopted | Yes — `src/os/desktop/issue-192.test.ts`, packaged placement spec | Yes | DONE |
| #195 | A: characterization/refactor packet consumed | No; characterization only | PR #213 merged; FileManager guards retained and consumed by #196 | Yes — current FileManager model/adapter tests and integrated guards | Yes | DONE |
| #61 | B: released characterization | No; characterization only | No standalone implementation; seam belongs to Shell reconstruction | Existing overlay interaction tests | Yes for characterized behavior | ALREADY GREEN |
| #63 | B: Alt-Tab RED remains | Yes — 1 staging file / 2 cases | No implementation PR | No | No | RED NOT CONSUMED |
| #72 | B: taskbar projection green | No; permanent model behavior already green | No implementation required | Yes — current taskbar projection/member tests | Yes | ALREADY GREEN |
| #87 | B: Start System retirement green | No; permanent reconciliation tests already green | No implementation required | Yes — `gate3` and Start migration tests | Yes | ALREADY GREEN |
| #91 | B: Search cap/safety RED remains | Yes — 1 staging file / 3 cases | No implementation PR | No; current gate still exposes ordinary-cap distinction failure | No | RED NOT CONSUMED |
| #109 | B: shared pin presentation green | No; characterization/equivalent Visual tests | No implementation required | Yes — Visual/Shell pin tests | Yes | ALREADY GREEN |
| #111 | B: visual characterization released | No valid corrective RED | No standalone implementation; cleanup belongs elsewhere | Shared Visual tests cover current primitives, not broad aesthetic redesign | Current deterministic behavior yes | ALREADY GREEN |
| #117 | B: RED consumed | Yes — 1 staging file / 1 case | PR #214 merged; placement persistence test adopted | Yes — `test/issue-117-window-placement.test.ts` plus Windowing tests | Yes | DONE |
| #118 | B: RED consumed | Yes — 1 staging file / 1 case | PR #237 merged; taskbar grouping/member tests adopted | Yes — `taskbar.test.ts`, `taskbarMember.test.ts` | Yes | DONE |
| #119 | B: transient ownership characterization | No valid corrective RED; no native transient consumer | No implementation required; app-local dialog contract retained | Existing close-dialog characterization only | Current scoped behavior yes | NO CORRECTIVE RED |
| #38 | Coordinator/Sharing/Backend-owned | No Luna RED; external Phase-A evidence only | Deferred outside Luna ownership; coordinator claim remains explicit | External Sharing/Backend regression evidence, not Luna product promotion | Not a Luna-r2 claim | DEFERRED |
| #58 | C: Review package/browser acceptance | No Luna executable RED | PR #206/Review CI evidence integrated | Yes — Review engine/package/e2e regression suite | Yes in current release | DONE |
| #64 | C: missing js-dos save boundary | No honest RED can be written before the production seam exists | Luna-C claim remains pending | No | No | HARNESS GAP |
| #89 | C: Monaco worker-path RED remains | Yes — 1 staging file / 1 case | No implementation PR; #200 dependency | No; current package route remains wrong | No | RED NOT CONSUMED |
| #96 | C: packaged identity metadata RED remains | Yes — 1 staging file / 1 case | No implementation PR | No; generated identity glyphs remain for affected handlers | No | RED NOT CONSUMED |
| #112 | C: native-app chrome characterization | No; no honest structural RED | No standalone implementation; shared Visual/cleanup ownership | Existing native-app/Visual characterization | Yes for scoped semantic behavior | ALREADY GREEN |
| #113 | C: Monaco RTL harness boundary | No honest executable RED in canonical RTL | Claimed harness gap; no fake Monaco/CSS.escape polyfill | No | No | HARNESS GAP |
| #114 | C: Markdown/Monaco RTL harness boundary | No honest executable RED in canonical RTL | Claimed harness gap; no fake Monaco harness | No | No | HARNESS GAP |
| #123 | C: missing game-artwork metadata contract | No valid corrective RED before metadata authority exists | Claimed product/test seam gap | No | No | HARNESS GAP |
| #124 | C: blocked screenshot persistence | No valid independent RED before #64 save artifact exists | Claimed dependency on #64 | No | No | HARNESS GAP |
| #78 | D: cross-surface lifecycle green | No; lifecycle characterization is green | No implementation required | Yes — shortcut/open cross-surface tests and lifecycle equivalent | Yes | ALREADY GREEN |
| #79 | D: document close composition green | No; current production graph passes | No implementation required | Yes — process/document/window close tests | Yes | ALREADY GREEN |
| #81 | D: taskbar lifecycle green | No; composed characterization/equivalent is green | No implementation required | Yes — current Process/Windowing/taskbar tests | Yes | ALREADY GREEN |
| #82 | D: managed-root bootstrap green | No; production composition already green | No implementation required | Yes — `managedRootBootstrap.test.ts`, Start/filesystem tests | Yes | ALREADY GREEN |
| #83 | D: runtime selection green | No; production association/open tests already green | No implementation required | Yes — runtime selection/headless tests | Yes for deterministic selection; engine startup remains browser-bound | ALREADY GREEN |
| #107 | D: packaged baseline boundary | No executable corrective RED | Browser/manual baseline disposition | Existing specialist/package evidence; no new D regression | Boundary evidence remains separate | DEFERRED |
| #25 | D: legacy gui2 removal RED remains | Yes — shared staging file / 1 case | No implementation PR | No; active legacy reachability remains under audit | No | RED NOT CONSUMED |
| #26 | D: legacy platform removal RED remains | Yes — shared staging file / 1 case | No implementation PR | No; active legacy consumers remain under audit | No | RED NOT CONSUMED |
| #46 | D: uninstall capability boundary | No valid corrective RED; explicit capability contract | No implementation required without Kernel capability | Contract/audit evidence only | No product behavior claim is made | NO CORRECTIVE RED |
| #100 | D: dependency metadata RED remains | Yes — 1 staging file / 2 cases | No implementation PR; native metadata remains stale/incomplete | No; current metadata audit is not green | No | RED NOT CONSUMED |

## Promotion totals

- **42 queue entries:** 42 unique live queue rows.
- **Finalized:** 36 `[x]` queue rows.
- **Still claimed:** 6 `[~]` rows: #38, #64, #113, #114, #123, #124.
- **Genuine intentional RED entries:** 13: #51, #65, #92, #192, #63, #91, #117, #118, #89, #96, #25, #26, #100.
- **Genuine REDs GREEN in current r2:** 6: #51, #65, #92, #192, #117, #118.
- **Genuine REDs GREEN only on open PRs:** 0. The six consumed REDs have merged PRs and current-release regression destinations.
- **Genuine REDs NOT CONSUMED:** 7: #63, #91, #89, #96, #25, #26, #100.

For reference, those 13 genuine RED files contain **23 test cases**: #51 (3), #65 (3), #92 (1), #192 (3), #63 (2), #91 (3), #117 (1), #118 (1), #89 (1), #96 (1), #25/#26 shared file (2), and #100 (2).

## Release conclusion

The answer to the primary question is **no**: 6 of 13 genuine executable RED entries are permanently GREEN in current r2; 7 remain unconsumed. The 7 are not upgraded by queue finalization, Issue state, or packet readiness.
