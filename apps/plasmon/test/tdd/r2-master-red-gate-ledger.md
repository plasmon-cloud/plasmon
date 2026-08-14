# r2 master RED-gate ledger (Luna-D closeout)

**Audit snapshot:** 2026-08-14; Luna-D runway plan `r2-refactor-runway-plan.md`; integrated release observed `82f176a6f11a163197a270a6c2275dde0f95a2e9`. Latest A/B/C packet refs consumed: A `0e7c56c`, B `ac3c61e`, C `aa82c7f`/`3174c7d`.

## Scope and result

The checkpoint inventory is **79 Issues**. The independent second pass expands the complete dependency/release universe to **103 Issues** by adding closed prerequisites, implemented unmilestoned consumers, and later-scope deferred dependencies. See `r2-deep-completeness-audit.md` for the 24 added rows and exact scope rationale. Issues #184 and #185 are included despite lacking a milestone because they are in the active r2 shell backlog. No issue is silently treated as complete because a PR or aggregate test count exists.

Fields are abbreviated in the table: **target** = canonical acceptance authority; **impl** = implementation owner/PR; **RED** = staging path; **GREEN** = intended ordinary discovery destination; **B** = real browser/package boundary; **gap** = unresolved evidence.

## Complete issue ledger

| Issue / title | target; state; owner | impl / deps | final disposition | RED / GREEN / B | gap; evidence |
|---|---|---|---|---|---|
| #25 Retire legacy gui2 | architecture; open; D | none; #167 baseline | HEADLESS RED | `.red/issue-25-26.red.test.ts` / refactor guards | current release still retains tree; removal proof fails intentionally |
| #26 Retire platform compatibility | architecture; open; D | none; #167 baseline | HEADLESS RED | `.red/issue-25-26.red.test.ts` / refactor guards | current release still retains tree/imports; removal proof fails intentionally |
| #38 Sharing reconciliation | sharing; open; external Sharing/Backend | Phase-A provider/backend integrated; MTN remains deferred | ALREADY GREEN PHASE A / COORDINATOR REVIEW | `src/os/sharing/*.test.ts`, backend methods, memory declaration | no new Plasmon RED; verify package/backend/docs and retain fail-closed MTN boundary |
| #43 edge snapping | WindowManager; open; B | PR75 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / `src/os/windowing/snap.test.ts` | closure state mismatch only; Issue, release tests |
| #44 Create Shortcut primitive | FsService; open; A | PR149 merged; #51 | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / `src/os/file-manager/create-shortcut.test.tsx` | #51 consumer is separate; Issue, release tests |
| #46 uninstall capability | Kernel boundary; open; D | PR84/104/163 merged | ALREADY GREEN — CAPABILITY BOUNDARY | contract/audit docs / package boundary | no app-facing Kernel uninstall capability is exposed; do not invent Plasmon UI semantics |
| #51 Send to Desktop | FileManager command; open; A | PR210 active exact head; #44 | PROMOTION ACCEPTED — NOT INTEGRATED | exact-head `send-to-desktop.test.ts` + RTL journey; no B required | current release lacks PR210; coordinator must consume promotion after merge |
| #58 Review Atom MVP | Neutron/Review; open; C | PR101/104 merged; #167 | CORE GREEN / PACKAGED REMAINDER | Review semantic/provider tests + installed e2e | standalone MVP is independent of #38/#125/#127; packaged evidence remains separately recorded |
| #61 Shell overlay controller | Shell model; open; B | none | CHARACTERIZATION READY | no packet / shell tests | no canonical packet on B branch |
| #63 Alt-Tab | Windowing MRU; open; B | none; WindowManager MRU green | VALID HEADLESS + RTL RED | B `issue-63.red.ui.test.tsx` / MRU tests | switcher command and accessible adapter remain absent |
| #64 js-dos persistence | filesystem/runtime; open; C | PR103 merged; #202 | CLOSURE AUDIT COMPLETE | historical / runtime tests | packaged storage boundary remains #202 |
| #65 operation progress | FileOperationState; open; A | PR208 merged in current release | ALREADY GREEN — COMPLETE CORE ACCEPTANCE | `operation-state.test.ts`, FileManager wiring, PR208 RTL/CI | current release is `2b6984e`; old one-file RED is provenance only |
| #66 drag preview stack | browser geometry; open; A | none | BROWSER SPEC ONLY | `.red` browser plan / Playwright | old packet is invalid/fake stacking; no executed gate |
| #67 packaged Monaco | installed runtime; open; C | PR131/188 merged; #200 | PACKAGED BROWSER SPEC ONLY | packet docs / specialist Playwright | local session/package execution not observed in this audit |
| #72 taskbar state | Shell projection; open; B | PR139 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / `taskbarPresentation.test.ts` | Issue label needs closure reconciliation |
| #78 shortcut lifecycle | cross-surface; open; A/D | #51 merged; #44 | NO IMPLEMENTATION REQUIRED — FINAL LUNA DISPOSITION | A `issue-78-closure-audit.md` + existing cross-surface core | queue claim released; no standalone implementation packet remains |
| #79 document close lifecycle | Process/Windowing; open; D/C | reconciliation complete | ALREADY GREEN — RECON COMPLETE | existing process/document/headless tests + C reconciliation | visible close UI remains browser/application evidence, not missing headless composition |
| #81 taskbar lifecycle | Shell/Process/Windowing; open; D/B | #72 | ALREADY GREEN — RECON COMPLETE | `apps/plasmon/test/taskbarLifecycle.test.ts` | B reports 3 passed/14 assertions; release claim should be resolved |
| #82 managed-root bootstrap | filesystem; open; D | PR133 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / `managedRootBootstrap.test.ts` | Issue still open |
| #83 runtime selection | runtime associations; open; D/C | Association/OpenService | ALREADY GREEN — RECON COMPLETE | existing runtime/headless tests + C reconciliation | engine startup remains browser; no second composed RED |
| #86 selectable diagnostic text | FileManager adapter; open; A | none | CHARACTERIZATION READY | `.red/issue-86.red.md` / normal FileManager RTL | no executable packet on integrated release |
| #87 retire System Start folder | Shell/filesystem; open; B | PR148 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / `startMenuSystemMigration.test.ts` | closure state mismatch |
| #89 Program Files Monaco workers | package/runtime; open; C | PR131 merged; #67/#200 | VALID HEADLESS RED + BROWSER REMAINDER | C `.red/issue-89.red.test.ts` / package + worker browser | current release still emits top-level `monaco-workers/*`; path gate fails |
| #91 search safety cap | Search model; open; B | none | VALID HEADLESS RED | B refreshed `issue-91.red.test.ts` / search model | ordinary-cap versus safety-truncation distinction remains failing |
| #92 multi-item move progress | FileOperationState; open; A | #65 merged | VALID RTL RED | A `.red/issue-92.red.md` + delayed real move RTL gate | drag path lacks running operation lifecycle; reuse merged #65 authority |
| #93 image aspect ratio | Visual; open; A | none | CORE GREEN / BROWSER VISUAL REMAINDER | visual/thumbnail tests + packaged geometry spec | lower containment is green; decoded rendered geometry remains |
| #94 video thumbnails | Visual/media; open; A | none | SPECIFICATION / MISSING PRODUCT SEAM | `.red/issue-94.red.md` / future browser media gate | no production frame-extraction lease; do not fake Bun decoder |
| #95 selected long labels | FileEntry geometry; open; A | PR159 merged; #191 distinction | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | `.red/issue-95.red.md` / label tests | must not be conflated with #191 bounds |
| #96 native identity assets | packaging/Visual; open; C | none | VALID HEADLESS/PACKAGE RED | C `.red/issue-96.red.test.ts` / package asset checks | six canonical app definitions still use generated data-URI glyphs |
| #100 dependency metadata | repository/GraphQL metadata; open; D | Coordinator migration | HEADLESS RED — semantic gate | `.red/issue-100.red.test.ts` + `r2-dependency-metadata-audit.md` | live gate fails stale #32→#30/#90→#49 and missing #78/#81/#83 native edges; no prose/source-shape assertions |
| #107 packaged baseline | Testing/Integration; open; D | PR152 merged; #167/#187 | BROWSER BOUNDARY — REFRESH REQUIRED | baseline matrix / smoke + specialist package lanes | current release advanced to `2b6984e`; no local packaged session evidence |
| #109 shared pin icon | Shell/Visual; open; A/B | PR150 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / visual + taskbar tests | closure state mismatch |
| #110 hidden-file preference | FileManager/FsService; open; A | PR151 merged | CORE GREEN / BROWSER REMAINDER | `preferences.test.ts` + packaged preference spec | persistence/filtering green; visible reopen/reload remains |
| #111 Shell visual convergence | Shell/Visual; open; B | PR150 merged; #190 | WAIT FOR INTEGRATION | no current B packet / Visual tests | broader convergence is not proven by pin icon alone |
| #112 native-app chrome | native apps; open; C | #190/#201 | NO STANDALONE IMPLEMENTATION REQUIRED | C characterization/reconciliation packet | broad visual cleanup/convergence belongs to #201 |
| #113 Text Monaco parity | Text; open; C | PR131 merged; #200 | PACKAGED BROWSER SPEC ONLY | packet docs / browser | chrome affordance proof not run |
| #114 Markdown commands | Markdown/Monaco; open; C | PR131 merged; #200 | CHARACTERIZATION READY | no packet / markdown tests | command UI acceptance absent |
| #115 resource commands | FileManager/FsService; open; A | #44/open/Trash/association seams | NO IMPLEMENTATION REQUIRED — FINAL LUNA DISPOSITION | `.red/issue-115.red.md` / existing delegated outcome tests | retain canonical delegated authorities; no generic command layer |
| #117 window placement persistence | WindowManager; open; B | none integrated | VALID HEADLESS RED | B `issue-117.red.test.ts` / WindowManager graph | durable moved placement does not survive recomposition |
| #118 taskbar grouping | Shell/Process; open; A/B | none | VALID HEADLESS RED | B `issue-118.red.test.ts` / taskbar projection | multiple native instances remain separate taskbar entries |
| #119 transient window ownership | Windowing; open; B | none | CHARACTERIZATION READY | no packet / process tests | acceptance not staged |
| #121 game fixture | package/runtime; open; C | PR163 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | historical / `src/games/demoFixture.test.ts` | separate from #181 fixture |
| #123 game artwork | Visual/games; open; C | none | CHARACTERIZATION READY | no packet / visual tests | artwork acceptance absent |
| #124 game save thumbnails | game persistence; open; C | none; #121 | WAIT FOR DEPENDENCY | no packet / game tests | blocked-labeled; screenshot boundary not staged |
| #155 Review demo fixture predecessor | demo package; open; C | PR156/158 merged; superseded by #181 | DEFERRED FROM r2 — CANONICAL EVIDENCE | historical / manifest harness | do not consume as #181 fixture contract |
| #167 shared RTL harness | Testing/Integration; open; D | PR188 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | `test/headlessEnvironment.ts`, `renderPlasmon.tsx`, RTL and docs / fast lane | GitHub issue remains open despite integrated evidence |
| #169 Start idempotence | Shell/filesystem; open; A | #82 green; #194 | IMPLEMENTATION READY | coordinator runway plan + #194 readiness; production Start reconciliation tests | standalone final packet should be adopted before branch; actual bug is managed-folder collision/idempotence |
| #170 Review first-demo | Review/browser; open; C | PR206 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | PR206 RTL/browser files / specialist B | issue state not closed; browser evidence is PR-owned |
| #171 icon probing | Neutron/Visual; open; A | none; #190 | WAIT FOR DEPENDENCY | `.red/issue-171.red.md` / icon resolver tests | request-budget acceptance not promoted |
| #172 occupied restore | Desktop placement; open; A | PR205 behavior; #192 | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | `.red/issue-172.composed.red.test.ts` / placement tests | integrated release has controller guards; close after explicit Issue review |
| #173 List view | FileManager adapter; open; A | PR212 merged; #196 | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | release List model/RTL + `test/e2e/plasmon-list-layout-173.spec.ts` | merged packaged smoke/spec CI passed; Issue closure bookkeeping remains |
| #174 canonical .sys Search | Shell/filesystem; open; A/B | #189/#190 merged; #193 | IMPLEMENTATION READY / VALID RED | A `.red/issue-174.red.{md,test.ts}` / Search model/composition tests | visible duplicate `.sys` projection remains; #193 must consume result model |
| #175 Search geometry | browser geometry; open; A | none; #193 | BROWSER SPEC ONLY | `.red/issue-175.red.md` / Playwright | exact geometry requires packaged browser |
| #176 context-menu ownership | browser adapter; open; A | #195/#197/#199 | IMPLEMENTATION READY / BROWSER BOUNDARY | A `.red/issue-176.red.md` / RTL + Playwright ownership tests | foreign Browser/Neutron/editor exceptions must remain explicit |
| #177 repeated window placement | WindowManager; open; B | none; #199 | CHARACTERIZATION READY | `.red/issue-177-acceptance-plan.md` / WindowManager tests | no canonical B packet |
| #178 MIME/language inference | classifier; open; A | none; #189 | VERIFIED CORE RED / INCOMPLETE ACCEPTANCE | `.red/issue-178.red.md` plus matrices / classifier tests | packet is characterization, implementation absent |
| #179 autosave preference | Text/Markdown; open; C | none; #200 | CHARACTERIZATION READY | no packet / document tests | opt-in UI/persistence criterion absent |
| #180 Photos expand | Photos/browser; open; C | none | BROWSER SPEC ONLY | no executable packet / Playwright | real viewport/fullscreen fallback required |
| #181 demo fixtures | Testing/filesystem; open; D | none; #167; #89/#121 excluded | VERIFIED CORE RED / INCOMPLETE ACCEPTANCE | no packet yet / desired production-bootstrap test | explicit opt-in fixture gate is missing; see #181 mapping |
| #182 root/Favorites inventory | filesystem/Shell; open; A | none; #194 | INVALID PACKET — DO NOT CONSUME | old `.red/issue-182*` | packet encoded test-local Favorites policy; replacement needed |
| #183 taskbar context actions | Shell; open; B | none; #198 | CHARACTERIZATION READY | no packet / taskbar tests | no accepted B packet |
| #184 TaskManager.sys | native system app; open; B | none | DEFERRED FROM r2 — CANONICAL EVIDENCE | no packet / no release target | not in r2 milestone/queue; future shell scope |
| #185 Show Desktop | Shell command; open; B | none | DEFERRED FROM r2 — CANONICAL EVIDENCE | no packet / no release target | not in r2 milestone/queue; future shell scope |
| #186 filesystem persistence | filesystem/package/browser; open; D | PR209 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | `test/e2e/plasmon-persistence.spec.ts` + CI / packaged B | durable retained-profile proof is integrated; Issue remains open |
| #187 refactor smoke | Testing/Integration; open; D | PR188 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | `test/refactorGuards.test.ts`, RTL, smoke/docs / packaged B | criterion audit in separate artifact; some owned allowances remain |
| #189 classification | FsService/classifier; open; A | PR207 merged | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | ordinary `src/os/fs`, dedicated refactor test, and consumers | merged release evidence; Issue closure bookkeeping remains |
| #190 presentation/assets | Visual/package; open; A | PR211 merged; #189/#187 | PROMOTED / ALLOWANCE RETIREMENT PENDING | release Visual test + packaged asset spec | smoke/spec CI green; old-root health allowances remain in smoke |
| #191 FileEntry pilot | FileEntry/geometry; open; A | PR204 merged; #187/#190 | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN | release characterization/RTL + packaged FileEntry spec | merged smoke/spec CI green; #95 remains separate |
| #192 placement controller | Desktop/WindowManager; open; A | PR205 merged | ALREADY GREEN CORE / BROWSER REMAINDER | `src/os/desktop/issue-192.test.ts` + packaged spec | current controller/tests are integrated; packaged execution evidence remains separate |
| #193 Search surface | Shell/Search; open; A | #174/#175/#189/#190 | IMPLEMENTATION READY AFTER #174 | A `.red/issue-193-*` readiness/state/surface contracts | #174 projection and #175 geometry are real prerequisites |
| #194 Start surface | Shell/Start; open; A | #169/#189/#190 | IMPLEMENTATION READY AFTER #169 | A `.red/issue-194-*` readiness/preservation contracts | reconciliation/controller boundary and Start geometry/state vocabulary |
| #195 FileManager decomposition | FileManager; open; A | #51/#65/#173/#189/#190/#191/#192 merged | PACKET COMPLETE — IMPLEMENTATION ACTIVE IN SOL PR #213 | A `0e7c56c` `.red/issue-195-final-packet.md` + characterization guard | TDD claim released; do not mark product acceptance green until PR #213 lands |
| #196 view strategies | FileManager; open; A | #195/#173 merged | IMPLEMENTATION READY AFTER #195 | A `0e7c56c` `.red/issue-196.recon.md` + #173 contracts | explicit view strategies; geometry browser evidence remains |
| #197 Shell decomposition | Shell; open; A/B | #193/#194/#176; #61/#111/#119 characterization | IMPLEMENTATION READY AFTER SURFACE CUTOVERS | coordinator plan + GitHub Issue body/B audit | Shell.tsx choke point; serialize all Shell surface migrations |
| #198 taskbar reconstruction | Shell/taskbar; open; B | #72/#81/#118/#183/#197/#190 | PACKET READY AFTER CONCRETE GATES | B `ac3c61e` `issue-198-refactor-red-packet.md` | #118/#183 must land first; preserve Process/Windowing |
| #199 native-window reconstruction | Windowing/React; open; B | #117/#177/#43/#187/#190 | PACKET READY AFTER #117/#177 | B `ac3c61e` `issue-199-refactor-red-packet.md` | real pointer/DOM geometry and health are required |
| #200 shared Monaco host | runtime/Monaco; open; A/C | #89/#67/#113/#114/#189 | FINAL PACKET READY — IMPLEMENTATION GATED | C `3174c7d` `issue-200-monaco-host-final-packet.md`; explicit A→Sol2 transfer required | real Worker/Firefox/opaque-origin proof; no fake Monaco |
| #201 visual cleanup | Visual; open; A | all refactor migrations | LAST / IMPLEMENTATION READY AFTER MIGRATIONS | A `0bf7175` `.red/issue-201-cleanup-readiness.md` | zero-consumer/import proof and final guard rerun; no concurrent cleanup |
| #202 js-dos sandbox storage | runtime/browser; open; C | none; #64/#121 | PACKAGED BROWSER SPEC ONLY | browser-health allowance / specialist browser | explicit browser execution required |

**UNCLASSIFIED: 0 in the 79-row checkpoint; 0 in the expanded 103-row universe.** “Complete” above means evidence was found at the stated layer, not that GitHub closure is authorized. The second pass corrected #45, #48, #58, #88, #90, #108, and #89 classifications; do not consume the first-pass row in isolation.

## Evidence roots

- Luna-A packet source: `origin/tdd/r2/luna-a-desktop`, especially commits `d522336`, `318966c`, `1e579bf`, `e56b246`, `1d55c3b`, `ac07da4`, and `8453df4`.
- Integrated release: `origin/release/0.1.0-r2` at `f4ac3b4c`; merged PRs #188, #205, #206, #207, #209.
- Active implementation PRs: #204, #208, #210, #211; see `r2-github-issue-pr-reconciliation.md`.
- Shared queue: `apps/plasmon/test/tdd/todo.md` on the staging branch.
