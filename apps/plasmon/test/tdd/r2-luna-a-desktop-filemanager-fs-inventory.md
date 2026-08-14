# Luna-A r2 Desktop / FileManager / Filesystem issue inventory

Refresh date: 2026-08-13

Integrated release inspected: `origin/release/0.1.0-r2` at
`f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

Ownership refresh: active PRs observed for #51/PR #210, #65/PR #208,
#190/PR #211, and #191/PR #204. Luna-B owns concrete Shell/taskbar/Windowing
issues; Luna-C owns Native Apps/media/editor issues; Luna-D owns cross-surface
and master closure ledgers. Active implementation and cross-lane packets are
not modified here.

Sources searched:

- all GitHub Issues matching Desktop/FileManager/filesystem/shortcut/Trash/
  Explorer/thumbnail/selection/rename/drag/drop/presentation terms;
- `milestone:0.1.0-r2` metadata and full Issue bodies;
- `apps/plasmon/test/tdd/todo.md`;
- `apps/plasmon/src/os/{desktop,file-manager,fs,visual,shell}` README/AGENTS and
  source dependencies;
- existing permanent fast, RTL, integration, and Playwright tests.

## A. Luna-A primary inventory

| Issue | Canonical owner | Active implementation? | Luna-A packet/evidence | Final disposition | Dependency | Executable RED? | Browser spec? | Closure/permanent GREEN destination |
|---|---|---|---|---|---|---|---|---|
| #44 | FileManager + Fs shortcut primitive | no PR | `issue-44-closure-audit.md` | ALREADY GREEN — COMPLETE CANONICAL ACCEPTANCE | #31 for open, already integrated | no honest new RED | packaged discoverability optional, not acceptance-required | `src/os/file-manager/create-shortcut.test.tsx`, `src/os/fs/desktopCore.test.ts`, `test/refactorGuards.test.ts`, `test/resourceOpenCrossSurface.test.ts` |
| #45 | Native Recycle Bin surface | implementation integrated (`17ef2c1`); no open PR | `issue-45-closure-audit.md` + Trash/restore matrices | ALREADY GREEN DETERMINISTIC CORE / PACKAGED BROWSER PENDING | Trash core integrated; packaged session required | no new RED | yes; packaged launch/render not executed locally | `src/native-apps/recycle-bin/model.test.ts`, `test/trashLifecycle.test.ts`, and narrow packaged launch proof |
| #52 | FileManager/Visual presentation | no PR observed | post-#189 consumer audit; Phase-1 matrices | WAIT FOR DEPENDENCY / PRESENTATION | #190 active, #171 separate | no competing #190 RED | browser/package asset boundary owned by #190 | Visual/FileManager component tests plus #190 promotion |
| #51 | FileManager shortcut consumer | **PR #210 active — DO NOT TOUCH** | prior Luna packet only | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | none for Luna | existing RTL RED belongs implementor | no new spec | PR #210 permanent tests |
| #65 | FileManager import/paste operation state | **PR #208 active — DO NOT TOUCH** | prior Luna packet only | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | none for Luna | existing RTL RED belongs implementor | no new spec | PR #208 permanent tests |
| #66 | Desktop/FileManager drag preview | today's unattended ownership | prior repaired browser packet; do not improve | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #176 boundary | no competing RED | existing packet only | implementor/D promotion |
| #78 | Cross-surface shortcut lifecycle | no PR; #51/PR #210 active | `issue-78-closure-audit.md` + integrated shortcut/open tests | WAIT FOR DEPENDENCY — #51 | #31/#44 integrated; #51 Send to Desktop absent from release | no honest complete gate until #51 integrates | no; deterministic headless first | existing 11-test core evidence plus future #51 consumer extension |
| #82 | managed-root bootstrap | no PR; integrated production tests | `issue-82-closure-audit.md` + managed-root/default-seed/core tests | ALREADY GREEN | none; current head covers full managed-root composition | no honest RED | no | `test/managedRootBootstrap.test.ts`, `src/os/fs/desktopCore.test.ts`, `defaultSeeds.test.ts` |
| #86 | FileManager diagnostic text selection | today's unattended ownership | prior browser packet; do not improve | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #66/browser text boundary | no competing RED | existing packet only | implementor/D promotion |
| #92 | FileManager drag-move operation state | no PR; #65/#208 integrated | `issue-92.red.md`, `issue-92.red.ui.test.tsx`, operation-model/preserve docs | RTL RED | current #65 state covers import/paste only; drag calls `moveNodesToDirectory` directly | yes; exact integrated-head RTL failure | no | implementor adopts drag lifecycle using existing operation authority, then adds success/partial/duplicate coverage |
| #93 | FileManager image thumbnail presentation | no PR observed | `issue-93-browser-geometry-spec.md`; improved existing browser spec | BROWSER SPEC ONLY | #52/#190 presentation seam | deterministic core already green | yes, not executed locally | `src/os/file-manager/polish.test.tsx`, Visual tests; packaged geometry promotion |
| #94 | FileManager/Visual video thumbnail boundary | no PR observed | three authority/eligibility/lifecycle docs | BROWSER SPEC ONLY / REFACTOR RED GAP | no current FileManager video-thumbnail seam | no honest RED without inventing API | yes, adoption-ready; no fixture/execution | future thumbnail adapter + Bun eligibility/lifecycle tests |
| #95 | Desktop selected filename geometry | today's unattended ownership | prior dedicated browser packet; do not improve | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #191 FileEntry seam | no competing RED | existing packet only | implementor/D promotion |
| #108 | Explorer/FileManager navigation | no PR observed | `issue-108-closure-audit.md` | VERIFIED CORE GREEN / INCOMPLETE ACCEPTANCE | no deterministic dependency | no new deterministic RED | packaged Back-button spec needed; blocked locally | `src/native-apps/explorer/navigation.test.ts`, `file-manager.test.ts`, `ExplorerApp.tsx` |
| #110 | FileManager/Explorer hidden preference | no PR observed | existing packet + `issue-110-packaged-persistence-contract.md` | BROWSER SPEC ONLY / DETERMINISTIC GREEN | none | no honest core RED | yes, not executed | `preferences.test.ts`, visibility tests, existing `plasmon-hidden-preference-110.spec.ts` |
| #171 | Neutron Element icon resolver | cross-lane Neutron/Visual; no active PR | `issue-171-installed-browser-spec.md`, `issue-171-request-budget-contract.md` | BROWSER SPEC ONLY | #190 distinct; installed Element runtime | deterministic resolver green | yes, not executed | `src/os/neutron/icon-resolver.test.ts`; installed request-budget promotion |
| #172 | Desktop placement + Trash restore composition | no PR; #192 integrated | refreshed composed test, closure audit, post-192 audit | ALREADY GREEN | clean detached worktree executed exact integrated #192 source | 2 deterministic headless tests passed; no browser needed | no | `issue-172.composed.red.test.ts` plus #192 controller and Trash lifecycle tests |
| #173 | FileManager List layout | today's unattended ownership | prior repaired packet; do not improve | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #196 future consumer | no competing RED | existing packet only | implementor/D promotion |
| #174 | Search `.sys` projection | today's unattended ownership | prior packet only | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #193 future | no competing RED | existing packet only | implementor/D promotion |
| #178 | filesystem/resource semantics | no PR observed | authority/precedence/consumer maps + integrated closure audit + duplicate audit | ALREADY GREEN — COMPLETE CORE ACCEPTANCE PROVEN | #189 integrated; local staging refresh needed for execution | no new RED; do not manufacture | no browser required | release `test/refactor/189/issue-189.test.ts` + classifier/Text/Properties/Search consumers |
| #182 | Explorer root/Favorites inventory | today's unattended ownership | prior packet only | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #194/#201 downstream | no competing RED | existing packet only | implementor/D promotion |
| #189 | resource classification/MIME seam | **PR #207 merged; integrated** | consumed as source authority, not reopened | INTEGRATED DEPENDENCY / CONSUMER FOLLOW-UP #178 | #178/#193/#201 | no reopen | no | release classifier tests and downstream promotion |
| #190 | shared Visual/presentation asset identity | **PR #211 active — DO NOT TOUCH** | post-#189 audit only | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #193/#198/#201 | no competing RED | implementor packet | PR #211 promotion |
| #191 | Desktop FileEntry pilot | **PR #204 active — DO NOT TOUCH** | decomposition readiness only | ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH | #195/#196/#95 | no competing RED | implementor packet | PR #204 promotion |
| #192 | Desktop deterministic placement | integrated in release | post-192 audit + composed #172 | INTEGRATED; COMPOSED CLOSURE PENDING | #172/#195/#196/#201 | no reopen | browser only if adapter claim | release #192 tests + #172 composed regression |
| #195 | FileManager decomposition | no PR observed | readiness v2, preservation/command/selection/drag/failure maps | CHARACTERIZATION READY — FINALIZE AFTER #191 | #191; #65/#51 active results | no honest structural RED | bounded behavior browser only | future behavior-preservation gates after #191 |
| #196 | Icons/List/Details strategies | no PR observed | common/specific contract + responsive corpus | WAIT FOR #195 + #173 | #195/#173 | no final RED yet | geometry browser spec future | shared semantic tests + view geometry promotion |
| #201 | residual cleanup | no PR observed | expanded cleanup audit | CLEANUP LATE / RECONNAISSANCE | all accepted migrations | no cleanup RED | package/import evidence as needed | deletion/import rules only after proof |

## B. Related older or cross-lane Issues accounted for

| Issue | Primary owner | Disposition for Luna-A |
|---|---|---|
| #25 | D/legacy OS retirement | NOT SAFE FOR LUNA-A; legacy gui2 reachability noted in #201; do not delete |
| #31 | Filesystem/Open integration, closed | CLOSURE PROVEN by `fileManagerActivation.test.ts`, `resourceOpenCrossSurface.test.ts`, `refactorGuards.test.ts`; dependency for #44/#78 |
| #32 | Shell/Open integration, closed | CLOSURE PROVEN by activation/cross-surface tests; B-owned surface dependency |
| #40 | FileManager Delete/Trash, closed | CLOSURE PROVEN by `fileManagerDelete.test.ts`, `trashLifecycle.test.ts`; no new RED |
| #47 | Properties/Open With presentation, closed | CLOSURE PROVEN by association/open-with and Visual tests; no new RED; #190 may consume presentation seam |
| #70 | Cross-surface open regression, closed | CLOSURE PROVEN by `test/resourceOpenCrossSurface.test.ts` and refactor guards |
| #77 | Cross-surface Trash lifecycle, closed | CLOSURE PROVEN by `test/trashLifecycle.test.ts` and filesystem tests |
| #80 | Association/OpenService composition, closed | D/cross-surface closure; `resourceOpenCrossSurface.test.ts` is permanent destination |
| #64 | js-dos save-state persistence | Luna-C/native-runtime ownership; filesystem identity dependency only; no competing packet |
| #96 | native app identity assets | Luna-C/native-app ownership; #190 dependency only, no competing packet |
| #109 | shared pin presentation | Luna-B ownership; no competing packet |
| #113 | Text/Monaco editor chrome | Luna-C ownership; no FileManager packet |
| #115 | shared resource-command layer | Luna-B ownership; FileManager preservation matrix records dependency only |
| #117 | native placement persistence | Luna-B ownership; #199 dependency only |
| #118 | taskbar grouping | Luna-B ownership; #198 dependency only |
| #123 | game artwork thumbnails | Luna-C ownership; presentation dependency only, no competing #94 packet |
| #124 | game save screenshot thumbnails | blocked on #64 and Luna-C/runtime boundary; no competing #94 packet |
| #177 | bounded repeated native-window placement | Luna-B/Windowing ownership; distinct from Desktop #192 placement |
| #185 | Show Desktop command | Luna-B Shell/Windowing ownership; no competing packet |
| #169 | Start reconciliation | today's/unattended or B ownership; #194 waits; no competing packet |
| #176 | browser context ownership | today's/B ownership; drag map records boundary only |
| #181 | first-demo fixtures | Luna-D/testing ownership; not duplicate FileManager fixtures |
| #183 | taskbar menus/actions | Luna-B ownership; #198 dependency only |
| #186 | packaged persistence | D/Testing Lead PR #209 integrated; Luna-A consumes no implementation packet |

## Inventory conclusion

Every discovered r2 Desktop/FileManager/filesystem-facing Issue is either:

- owned by Luna-A as a truthful closure/specification artifact;
- actively owned and explicitly fenced off;
- a dependency waiting for another lane/Issue;
- a browser/package boundary without local execution; or
- already closed with permanent evidence.

No additional unowned Desktop/FileManager/Filesystem product Issue was found in
the Issue search, r2 milestone, TDD queue, or canonical source dependency scan.
