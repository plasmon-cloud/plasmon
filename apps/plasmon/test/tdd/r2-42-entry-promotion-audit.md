# R2 42-entry TDD closure / promotion matrix

Audited release: `origin/release/0.1.0-r2` at
`8cfb4d68414b271303bd0afefdcac9dc8449c315`.

This is the authoritative Luna A/B/C/D queue matrix. TDD disposition is
separate from promotion state. A terminal disposition does not claim that
product implementation, browser execution, Issue closure, or external
ownership is complete.

| Issue | Luna lane | Final TDD disposition | Intentional RED? | RED/gate path | Product owner | Implementation PR/disposition | Permanent regression | Green in current r2? | Promotion state |
|---|---|---|---|---|---|---|---|---|---|
| #44 | A | ALREADY GREEN | No | closure audit; no corrective RED | FileManager/Fs | no implementation required | shortcut/filesystem/open guards | Yes | GREEN IN R2 |
| #51 | A | GREEN IN CURRENT R2 | Yes; 2 files/3 cases | `.red/issue-51.red.test.ts`, `.red/issue-51.red.ui.test.tsx` | FileManager | PR #210 merged | `send-to-desktop.test.ts`, RTL #51 | Yes | GREEN IN R2 |
| #65 | A | GREEN IN CURRENT R2 | Yes; 1 file/3 cases | `.red/issue-65.red.ui.test.tsx` | FileManager | PR #208 + #232 merged | `operation-state.test.ts`, RTL #65 | Yes | GREEN IN R2 |
| #66 | A | BROWSER BOUNDARY | Yes; browser-only gate | `test/e2e/plasmon-drag-preview-66.red.spec.ts` | FileManager/browser | no implementation PR; browser evidence packet | no permanent product promotion yet | Not established | NOT APPLICABLE |
| #86 | A | BROWSER BOUNDARY | Yes; browser-only gate | `test/e2e/plasmon-diagnostic-selection-86.red.spec.ts` | FileManager/browser | no implementation PR; browser evidence packet | no permanent product promotion yet | Not established | NOT APPLICABLE |
| #92 | A | GREEN IN CURRENT R2 | Yes; 1 file/1 case | `.red/issue-92.red.ui.test.tsx` | FileManager | PR #223 merged | `move-operation.test.ts`, operation presentation, RTL #92 | Yes | GREEN IN R2 |
| #93 | A | BROWSER BOUNDARY | No executable RED; browser geometry | image-thumbnail browser spec | Visual/FileManager | no implementation PR | deterministic Visual/thumbnail tests; browser proof separate | Deterministic only | NOT APPLICABLE |
| #94 | A | DEFERRED | No valid corrective RED | video eligibility/lifecycle contracts | Visual/media | no production thumbnail seam | none yet; future media adapter required | No | NOT APPLICABLE |
| #110 | A | GREEN IN CURRENT R2 | No; deterministic behavior green | hidden-preference contract/browser spec | FileManager/Fs | PR #151 integrated | preference/visibility tests; packaged browser spec pending | Core yes | GREEN IN R2 |
| #115 | A | NO VALID CORRECTIVE RED | No | characterization/authority map only | Filesystem/Open/Trash | no implementation required | existing delegated command tests | Existing behavior yes | NOT APPLICABLE |
| #192 | A | GREEN IN CURRENT R2 | Yes; 1 file/3 cases | `.red/issue-192.red.test.ts` | Desktop | PR #205 merged | `src/os/desktop/issue-192.test.ts`, layout/e2e guards | Yes | GREEN IN R2 |
| #195 | A | GREEN IN CURRENT R2 | No; characterization only | `.red/issue-195.red.test.ts` | FileManager | PR #213 merged; consumed by #196 | FileManager adapter/model and #196 strategy guards | Yes | GREEN IN R2 |
| #61 | B | CHARACTERIZATION ONLY | No | `.red/issue-61.characterization.ui.test.tsx` | Shell | no standalone implementation; #197 boundary | existing Shell interaction tests | Yes for characterized behavior | NOT APPLICABLE |
| #63 | B | INTENTIONAL RED READY | Yes; 1 file/2 cases | `.red/issue-63.red.ui.test.tsx` | Shell/Windowing | no implementation PR | none yet | No | RED NOT CONSUMED |
| #72 | B | ALREADY GREEN | No | permanent taskbar projection tests | Shell/Process/Windowing | no implementation required | taskbar/taskbarPresentation/shell tests | Yes | GREEN IN R2 |
| #87 | B | ALREADY GREEN | No | Start migration characterization | Shell/Fs | integrated history | `gate3.test.ts`, Start migration tests | Yes | GREEN IN R2 |
| #91 | B | INTENTIONAL RED READY | Yes; 1 file/3 cases | `.red/issue-91.red.test.ts` | Shell/Search | no implementation PR | none; ordinary-cap distinction still fails | No | RED NOT CONSUMED |
| #109 | B | ALREADY GREEN | No | pin/Visual characterization | Visual/Shell | PR #150 integrated | Visual and Shell pin tests | Yes | GREEN IN R2 |
| #111 | B | CHARACTERIZATION ONLY | No | Visual/token acceptance map | Visual/Shell | no standalone implementation; cleanup separate | shared Visual/Shell tests | Yes for deterministic contract | NOT APPLICABLE |
| #117 | B | GREEN IN CURRENT R2 | Yes; 1 file/1 case | `.red/issue-117.red.test.ts` | Windowing/Fs | PR #214 merged | placement model and `test/issue-117-window-placement.test.ts` | Yes | GREEN IN R2 |
| #118 | B | GREEN IN CURRENT R2 | Yes; 1 file/1 case | `.red/issue-118.red.test.ts` | Shell/Process/Windowing | PR #237 merged | taskbar/taskbarMember/taskbarPresentation tests | Yes | GREEN IN R2 |
| #119 | B | DEFERRED | No valid corrective RED | `.red/issue-119.characterization.test.tsx` | Windowing/Process | no native transient consumer; defer | app-local close prompt tests | Scoped behavior yes | NOT APPLICABLE |
| #38 | D / Coordinator | EXTERNAL / COORDINATOR BOUNDARY | No Luna RED | `issue-38-final-tdd-disposition.md`; Sharing tests | Sharing/Backend/Neutron | historical PR #39 evidence; external package/security review remains | provider/share/snapshot/resource-type tests; fail-closed import | Luna does not claim live MTN green | NOT APPLICABLE |
| #58 | C | GREEN IN CURRENT R2 | No corrective RED | Review model/package/e2e acceptance | Review/Coordinator | PR #206 and Review CI integrated | Review engine/persistence/validation/e2e tests | Yes | GREEN IN R2 |
| #64 | C | BLOCKED BY PRODUCT DEPENDENCY | No valid RED before seam | current js-dos adapter exposes no save/restore result | Games/runtime owner | no implementation; production save seam required | none until supported save boundary exists | No | NOT APPLICABLE |
| #89 | C | GREEN IN OPEN PR | Yes; 1 file/1 case | `.red/issue-89.red.test.ts` | Monaco/package runtime | PR #265 open; permanent route/package/browser tests added | `monacoEnvironment.test.ts`, packaging guards, worker Playwright spec on PR | No; PR not merged | GREEN IN OPEN PR |
| #96 | C | GREEN IN CURRENT R2 | Yes; 1 file/1 case | `.red/issue-96.red.test.ts` | Native app packaging/Visual | PR #264 merged | `src/native-apps/issue-96.test.ts`, packaged asset guards | Yes | GREEN IN R2 |
| #112 | C | ALREADY GREEN | No | semantic chrome characterization | Native Apps/Visual | no implementation required | native-app/Visual characterization | Yes for scoped behavior | GREEN IN R2 |
| #113 | C | HARNESS GAP | No valid canonical RTL RED | real Monaco cannot mount in Happy DOM (`CSS.escape` absent) | Text/Monaco/Testing | no fake Monaco/polyfill; browser remainder separate | no permanent RTL editor regression yet | No | NOT APPLICABLE |
| #114 | C | HARNESS GAP | No valid canonical RTL RED | same real Monaco RTL boundary; formatter UI also absent | Markdown/Monaco/Testing | no fake Monaco/polyfill; browser remainder separate | no permanent RTL formatter regression yet | No | NOT APPLICABLE |
| #123 | C | BLOCKED BY PRODUCT DEPENDENCY | No valid RED before artwork contract | #190 has no accepted game-artwork metadata contract | Games/Visual | contract owner required | none until metadata authority exists | No | NOT APPLICABLE |
| #124 | C | BLOCKED BY PRODUCT DEPENDENCY | No valid RED before #64 | no authoritative js-dos save artifact/capture boundary | Games/runtime/Visual | waits on #64 | none until save identity/boundary exists | No | NOT APPLICABLE |
| #78 | D | ALREADY GREEN | No | lifecycle characterization/equivalent tests | Cross-surface Fs/Open | no implementation required | shortcut/open lifecycle tests | Yes | GREEN IN R2 |
| #79 | D | ALREADY GREEN | No | close lifecycle composition | Process/Windowing | no implementation required | document/process/window tests | Yes | GREEN IN R2 |
| #81 | D | ALREADY GREEN | No | composed taskbar characterization | Testing/Shell | no implementation required | taskbar lifecycle equivalent tests | Yes | GREEN IN R2 |
| #82 | D | ALREADY GREEN | No | managed-root bootstrap characterization | Filesystem/Shell | no implementation required | `managedRootBootstrap.test.ts`, migration tests | Yes | GREEN IN R2 |
| #83 | D | ALREADY GREEN | No | runtime association/open characterization | Associations/runtime | no implementation required | runtime selection/headless tests | Yes for deterministic selection | GREEN IN R2 |
| #107 | D | BROWSER BOUNDARY | No executable corrective RED | installed packaged baseline | Testing/Integration | browser/manual evidence boundary | specialist packaged baseline | Boundary only | NOT APPLICABLE |
| #25 | D | INTENTIONAL RED READY | Yes; shared file/1 case | `.red/issue-25-26.red.test.ts` | Legacy OS retirement/Testing | no implementation PR | none; `src/gui2` remains in release tree | No | RED NOT CONSUMED |
| #26 | D | INTENTIONAL RED READY | Yes; shared file/1 case | `.red/issue-25-26.red.test.ts` | Legacy platform retirement/Testing | no implementation PR | none; `src/platform` remains in release tree | No | RED NOT CONSUMED |
| #46 | D | NO VALID CORRECTIVE RED | No | capability-boundary contract | Neutron/Coordinator | no product implementation authorized | explicit capability audit only | No product behavior claim | NOT APPLICABLE |
| #100 | D | INTENTIONAL RED READY | Yes; 1 file/2 cases | `.red/issue-100.red.test.ts` | Release metadata/Coordinator | no implementation PR | no green metadata audit; native dependency metadata remains incomplete | No | RED NOT CONSUMED |

## Counts

1. Total queue entries: **42**.
2. Finalized entries: **42**.
3. Claimed entries: **0**.
4. Open entries: **0**.
5. Genuine intentionally-failing executable RED entries: **13** — #51, #65, #92, #192, #63, #91, #117, #118, #89, #96, #25, #26, #100.
6. Genuine RED files: **13**.
7. Test cases in those genuine RED files: **23**.
8. Browser-only RED/boundary entries: **7** — #66, #86, #93, #94, #110, #58, #107. This category is orthogonal to the original 13 executable staging RED definition.
9. Characterization/already-green entries: **12** — #44, #61, #72, #87, #109, #111, #112, #78, #79, #81, #82, #83.
10. No-valid-corrective-RED entries: **2** — #115, #46.
11. Product-dependency-blocked entries: **3** — #64, #123, #124.
12. Deferred entries: **2** — #94, #119.
13. Genuine REDs GREEN in current r2: **7** — #51, #65, #92, #96, #117, #118, #192.
14. Genuine REDs GREEN only in open PRs: **1** — #89 / PR #265.
15. Genuine REDs not consumed: **5** — #63, #91, #25, #26, #100.

The 13 genuine RED files contain 23 cases: #51 (3), #65 (3), #92 (1),
#192 (3), #63 (2), #91 (3), #117 (1), #118 (1), #89 (1), #96 (1), shared
#25/#26 (2), and #100 (2).

## #38 preservation/change/unspecified boundary

The final #38 packet is `apps/plasmon/test/tdd/issue-38-final-tdd-disposition.md`.
It preserves immutable provider/snapshot storage, chunk/integrity/revision
validation, token-free `ShareRecord`, faithful generic authorization, revoke
delegation, fail-closed import, no bearer persistence, no shadow MTN database,
no direct cross-AppScope access, and no CRDT/live collaboration. It specifies
no Luna product change. Future live MTN redemption/provider-call architecture
is explicitly unspecified and remains an external Neutron/MTN dependency.

## Promotion conclusion

Every RED that is GREEN in current r2 has an ordinary permanent regression and
merged implementation evidence. #89 has permanent regression coverage on open
PR #265 but is not current-r2 GREEN. Five genuine REDs remain unconsumed and
are not promoted by Issue closure or packet finalization.
