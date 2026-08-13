# r2 RED → durable GREEN promotion ledger

Rule applied: a passing fast-suite count is not promotion evidence. Each row names the permanent file and assertions inspected. Snapshot release: `f4ac3b4c`; active PR heads are not integrated.

| Issue | final Luna packet | RED path / contract | implementation | durable release path | status |
|---|---|---|---|---|---|
| #44 | historical PR149 packet | canonical shortcut primitive: stable target, collision, rename | PR149 | `src/os/file-manager/create-shortcut.test.tsx` | PROMOTED EXACTLY |
| #51 | A `d522336` + repaired A packet (`8453df4` tree) | NodeId target, original parent, collision/repeat, rename, missing target/Desktop, no partial state, plus UI command | PR210 active | PR only has `test/rtl/issue-51-send-to-desktop.test.tsx`, one happy path | **NOT PROMOTED — RED PROMOTION GAP — #51** |
| #65 | A repaired packet `d522336` tree | >=2 files, item count, pending between writes, second observable, partial success/failure, alert, duplicate suppression, paste lifecycle, no byte progress | PR208 active | PR only has `test/rtl/issue-65-operation-progress.test.tsx`: one import + one paste, one file each | **PARTIALLY PROMOTED — RED PROMOTION GAP — #65** |
| #66 | A `ac07da4` browser packet | drag preview above real window stack / hit testing | none | none | WAITING IMPLEMENTATION |
| #86 | A packet `issue-86.red.md` | diagnostic text selectable | none | none | WAITING IMPLEMENTATION |
| #92 | A packet `issue-92.red.md` | multi-item move progress, failure semantics | none; depends #65 | none | WAITING IMPLEMENTATION |
| #93 | A packet `issue-93.red.md` | source aspect ratio retained | none | `src/os/visual/visual.components.test.tsx` is related but not Issue-specific | PARTIALLY PROMOTED |
| #94 | A packet `issue-94.red.md` | bounded supported video thumbnail | none | `src/native-apps/video/media.test.ts` is MIME/capability only | NOT PROMOTED |
| #95 | A packet `issue-95.red.md` | selected/focused long-label expansion without moving icon | PR159 merged | `src/os/file-manager/desktop-label.test.tsx` | PROMOTED AS STRONGER EQUIVALENT (do not conflate with #191) |
| #108 | A packet on Luna-A branch | deterministic navigation seam | PR? not in r2 inventory | no r2 release proof | STALE PACKET PROMOTED |
| #109 | A map `issue-109-acceptance-map.md` | shared pin artwork and state | PR150 merged | `src/os/visual/visual.components.test.tsx`, taskbar tests | PROMOTED AS STRONGER EQUIVALENT |
| #110 | A `issue-110.red.md` | FsService-backed hidden preference and reconstruction | PR151 merged | `src/os/file-manager/preferences.test.ts` | PROMOTED EXACTLY |
| #115 | A `issue-115.red.md` | shared resource command authority | none | no Issue-specific ordinary test | WAITING IMPLEMENTATION |
| #118 | A truth table | grouped process identity/state in taskbar | none | shell taskbar tests cover multiple processes, not grouping contract | PARTIALLY PROMOTED |
| #171 | A `issue-171.red.md` | bounded icon probing / no speculative requests | none | `src/os/neutron/icon-resolver.test.ts` bounds probes, but no Issue promotion | PARTIALLY PROMOTED |
| #172 | A composed packet `issue-172.composed.red.test.ts` | occupied Desktop restore preserves incumbents | PR205/#192 merged | placement controller tests (`src/os/desktop/layout.test.ts`) | PROMOTED AS STRONGER EQUIVALENT |
| #173 | A `issue-173.red.md` | real compact List columns and responsive geometry | none | none | WAITING IMPLEMENTATION |
| #174 | A `issue-174.red.test.ts` | Search uses one canonical `.sys` projection and activation | none | `src/os/shell/search-projection.test.ts` covers related projection | PARTIALLY PROMOTED |
| #175 | A `issue-175.red.md` | exact Search panel geometry across category changes | none; #193 | smoke allowance only; no exact ordinary/browser gate | NOT PROMOTED |
| #176 | A `issue-176.red.md` | Plasmon context-menu ownership | none | `src/os/file-manager/gate3.test.tsx` protects source ownership only | PARTIALLY PROMOTED |
| #177 | A plan `issue-177-acceptance-plan.md` | repeated native-window placement reachable | none | WindowManager geometry tests are deterministic but not Issue-specific | PARTIALLY PROMOTED |
| #178 | matrices + `issue-178.red.md` | filename MIME/language precedence and consumers | none; #189 | `src/os/fs/resourcePolicy.test.ts`/consumer tests cover classifier, not all future packet | PARTIALLY PROMOTED |
| #182 | old `issue-182.red.{test,ui}.test.tsx` | root/Favorites policy | none | none | INVALID LUNA PACKET — RETIRED |
| #183 | A `issue-183.red.md` | taskbar context menu actions and placement | none | none | WAITING IMPLEMENTATION |
| #189 | A `318966c` packet; implementation adopted RED | canonical classification precedence and all consumers | PR207 merged | `src/os/fs/resourcePolicy.test.ts` plus FileManager/Search/Text/Photos/Video consumers | PROMOTED AS STRONGER EQUIVALENT |
| #190 | A `318966c` packet | actual installed `/app/plasmon/static/...` requests load; resolver composition | PR211 active | PR branch `src/os/visual/issue-190.test.ts` + `test/e2e/plasmon-presentation-assets.spec.ts`; not release | WAITING MERGE |
| #191 | A `1e579bf` packet, adopted/retired guards | NodeId state, selection/activation/context/rename, bounded editor/long label distinction | PR204 active | PR branch normal Bun/RTL + `test/e2e/plasmon-file-entry-191.spec.ts`; not release | WAITING MERGE |
| #192 | A `e56b246` packet | deterministic placement/incumbent preservation and adapter | PR205 merged | `src/os/desktop/layout.test.ts`, `test/e2e/plasmon-desktop-placement-192.spec.ts` as merged in PR | PROMOTED EXACTLY |
| #195 | A `1d55c3b` packet | decomposed FileManager wiring preserves canonical command path | none | none | WAITING IMPLEMENTATION |
| #67/#89/#113/#200 | A docs/browser contracts; C owner | real Monaco worker/package/runtime acceptance | PR131/188 related only | `src/native-apps/text/monacoAdapter.test.ts` is deterministic; specialist browser required | PACKAGED BROWSER SPEC ONLY |
| #186 | Testing Lead packet; PR209 | stable identity/content/origin through close/reload/context relaunch | PR209 merged | `test/e2e/plasmon-persistence.spec.ts` and `.github/workflows/plasmon-browser-persistence-ci.yml` | PROMOTED EXACTLY |
| #187 | D packet/PR188 | assembled boot, open, authorities, health, geometry | PR188 merged | `test/refactorGuards.test.ts`, `test/rtl/refactorGuardSmoke.test.tsx`, packaged smoke/docs | PROMOTED AS STRONGER EQUIVALENT |
| #167 | D harness packet/PR188 | shared headless production graph + RTL + package policy | PR188 merged | `test/headlessEnvironment.ts`, `test/renderPlasmon.tsx`, `test/rtl/*`, TESTING.md | PROMOTED EXACTLY |
| #170 | C/PR206 packet | readable Review workflow, identity and browser assertions | PR206 merged | PR206 ordinary Review tests/e2e | PROMOTED EXACTLY |
| #58 | C/PR101 + integration PR104 | standalone logical Atom identity, typed commands, one revision/command, concurrency conflict, history/restore, persistence/reopen, Markdown/TODO portability | PR101 merged through PR104 | `apps/review/test/engine.test.ts`, `persistence.test.ts`, `markdown.test.ts`, validation tests, `apps/review/e2e/review.spec.ts` and Review CI | PROMOTED EXACTLY |
| #38 | Backend/Agent 9 PR39 reconciled through PR104 | provider chunks/integrity/revisions, safe share/revoke subset, no bearer persistence; fail-closed MTN import | PR39 source integrated by PR104 | `apps/plasmon/src/os/sharing/provider.test.ts`, `shareService.test.ts`, backend package/schema/docs | PROMOTED AS STRONGER EQUIVALENT for Phase A; future MTN remains explicitly deferred |

## Required #65 gap (not prose-only)

PR #208's adopted file has exactly two tests. Its import test supplies one `File`, observes only `role=status` existence, releases one write, and checks status clears. Its paste test supplies one source, observes “Pasting 1 item”, releases, and checks status clears. It does **not** assert: (1) two actual files; (2) truthful `1 of 2`/count transition; (3) operation remains running between controlled writes while the second item is pending; (4) second item becomes observable; (5) partial success with failed item absent; (6) visible failure alert; (7) duplicate trigger does not start a second operation; (8) paste cleanup/error lifecycle; (9) no fake byte progress; or (10) the production `FileOperationState` model as the source of truth. This is a release-blocking promotion gap, not a request to edit PR #208.

## Required #51 gap

PR #210's `test/rtl/issue-51-send-to-desktop.test.tsx` proves one selected text file yields a shortcut whose serialized metadata contains its target ID. It does not prove repeated creation/collision naming, original target parent/identity preservation, shortcut rename preserving identities, missing target failure, missing Desktop failure, eligibility rejection, or no partial shortcut state. The repaired lower packet has those assertions, but they are not in the PR or integrated release.

## Second-pass corrections

- #58 is not waiting for implementation: PR #101 and the standalone Review CI/e2e are integrated. The remaining #125/#127 live-sharing boundary is not part of #58 MVP.
- #45's packaged launch/render assertion is in `test/e2e/plasmon-golden-path.spec.ts`; the native model tests cover the canonical Trash operations.
- #48 has implementation and a real packaged EmulatorJS proof; it remains a packaged/browser acceptance row, not an absent production seam.
- #108 has a durable navigation model but no Issue-specific packaged Back-button assertion in the configured specialist lane.
- #89 remains a true implementation gap: current `build.ts` emits top-level `monaco-workers/*`, not `/System/Program Files/MonacoEditor`.

## Promotion rule for implementors

A RED file may be copied into a PR temporarily, but the final test must be in ordinary discovery (`src/**.test.*`, `test/**`, or the appropriate packaged `test/e2e/**`) and retain the packet's behavioral strength. The current release has no evidence that a red-only file was renamed into an ordinary location for the unresolved packets above.
