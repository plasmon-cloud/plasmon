# Luna-A RED promotion ledger

This lane-local ledger complements Luna-D's master ledger. Refresh:
integrated `4024addc4902cd019b64df548e4fb2dbf84cd053`. Active implementation
ownership: #92/PR #223, #169/PR #221, and #193/PR #219; do not modify those
branches or implementation packets.

| Issue | Validated packet commit/file | RED/spec files | Behavioral contract | Implementation PR | Permanent test expected | Permanent test observed | Promotion status |
|---|---|---|---|---|---|---|---|
| #44 | Phase-2 closure | `issue-44-closure-audit.md` | canonical shortcut, NodeId, collision/open lifecycle | none | `create-shortcut.test.tsx`, fs/refactor guards | observed/source inspected | ALREADY GREEN — COMPLETE CANONICAL ACCEPTANCE |
| #51 | integrated dependency `f345988` | `send-to-desktop.test.ts`, RTL #51 | Send to Desktop shortcut consumer | merged #210 | focused/headless + RTL tests | current release tests passed | INTEGRATED / CONSUMED |
| #65 | integrated dependency `2b6984e` | operation-state + RTL #65 | import/paste operation state | merged #208 | focused/headless tests; specialist RTL remains #65-owned | operation-state guards green; specialist timeout recorded separately | INTEGRATED / #92 FOLLOW-UP RED |
| #66 | repaired packet `789279e`/`6eb5cc5` | existing #66 browser spec | drag preview stacking/hit/drop/cancel | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #86 | repaired packet `6eb5cc5` | existing #86 browser spec | diagnostic selection/drag distinction | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #93 | Phase-2 current HEAD | existing spec + `issue-93-browser-geometry-spec.md` | rendered aspect-ratio containment | none | polish/Visual tests + packaged geometry | pure tests observed; browser blocked | BROWSER SPEC ONLY |
| #94 | Phase-2 current HEAD | three contract docs | bounded video still lifecycle | none | future thumbnail adapter tests | no production seam | BROWSER SPEC ONLY / REFACTOR RED GAP |
| #95 | prior repaired packet | existing browser spec | selected label overlay geometry | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #108 | Phase-2 current HEAD | `issue-108-closure-audit.md` | Explorer history model | none | navigation/file-manager tests | observed green | CORE GREEN / BROWSER GAP |
| #110 | prior packet + Phase-2 contract | existing browser spec + contract | Fs-backed hidden preference | none | pref/visibility tests | observed green; browser blocked | BROWSER SPEC ONLY |
| #171 | Phase-2 current HEAD | installed spec + budget contract | bounded Element icon requests | none | resolver tests | observed deterministic green; browser blocked | BROWSER SPEC ONLY |
| #45 | closure audit | `issue-45-closure-audit.md` | Native Recycle Bin projection and canonical Trash actions | integrated `17ef2c1` | model/filesystem closure test | packaged session journal absent | ALREADY GREEN core / browser pending |
| #78 | integrated #31/#44/#51 closure | `issue-78-closure-audit.md`, `issue-78.lifecycle.test.ts` | shortcut create/rename/move/open across FileManager/Start/Search | none | 1 lifecycle test + 11 core tests | exact release-head lifecycle passed | COMPLETE / NO IMPLEMENTATION REQUIRED |
| #82 | integrated bootstrap audit | `issue-82-closure-audit.md` | managed-root idempotence, repair, preservation, projection boundaries | none | exact release-head suite: 12 passed, 74 expects | complete integrated production-graph evidence | ALREADY GREEN |
| #92 | integrated #65 follow-up | `issue-92.red.md`, `issue-92.red.ui.test.tsx` | drag move exposes truthful item operation lifecycle | none; #65 integrated prerequisite | exact release-head RTL gate | delayed real move reaches missing status assertion | TDD:RTL RED |
| #172 | refreshed integrated-head packet | `issue-172.composed.red.test.ts`, `issue-172-closure-audit.md` | Trash restore preserves free/occupied placement and incumbent identity | #192 integrated | clean detached release worktree: 2 tests passed, 13 expects | exact current controller and real Trash restore executed | ALREADY GREEN |
| #173 | integrated #212 | spatial navigation/List tests | compact spatial List | merged #212 | integrated headless/browser evidence | integrated | INTEGRATED / CONSUMED |
| #174 | integrated closure | `issue-174-closure-audit.md`, repaired RED | single canonical `.sys` projection | none | Search projection tests | 3 passed, 13 expects | COMPLETE / NO IMPLEMENTATION REQUIRED |
| #175 | Phase-1/2 current | geometry spec | stable Search geometry | none | packaged browser geometry | syntax listed; execution blocked | BROWSER SPEC ONLY |
| #178 | integrated closure | authority/precedence/consumer maps + integrated closure audit | shared MIME/language semantics | #189 integrated | `test/refactor/189/issue-189.test.ts` and consumer imports | integrated release evidence | ALREADY GREEN — COMPLETE CORE ACCEPTANCE |
| #182 | prior packet | existing core/RTL packet | root/Favorites inventory | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #190 | integrated #211 | Visual/presentation tests | package asset identity | merged #211 | Visual/package tests | integrated source/tests passed | INTEGRATED / CONSUMED |
| #191 | integrated #204 | FileEntry state/RTL/browser packet | Desktop FileEntry pilot | merged #204 | FileEntry + RTL/browser tests | integrated source/tests passed | INTEGRATED / #195 CONSUMED |
| #169 | final packet | `issue-169-final-packet.md`, `issue-169.red.test.ts` | Start reconciliation collision safety | none | headless reconciliation tests | malformed Accessories sibling rejects current path | HEADLESS RED / #194 BLOCKER |
| #193 | final packet | `issue-193-final-packet.md` | focused Search surface over canonical results | none | Search model/RTL + #175 browser | no structural RED; #174 complete | FINAL PACKET READY / #175 BOUNDARY |
| #194 | final packet | `issue-194-final-packet.md` | focused Start surface over `/System/Start Menu` | none | Start migration/RTL + #169/#175 | blocked by #169 | BLOCKED — #169 |
| #196 | merged #215 at `4024add` | `issue-196-final-packet.md`, `issue-196.recon.md`, integrated strategy guards | Icons/List/Details strategies over #195 adapters | merged #215 | 17 focused tests + 1 RTL strategy test; geometry remains browser-owned | current release guards pass; no truthful structural RED | ALREADY GREEN / INTEGRATED |
| #197 | Luna-A input packet | `issue-197-luna-a-shell-input-packet.md` | Shell composition/authority boundaries | Luna-B-owned | cross-surface guards | no competing Shell packet | BLOCKED — Luna-B |
| #192 | integrated dependency | #172 composed closure | Desktop placement controller | merged #205 | release #192 tests + #172 composed gate | integrated source and clean-worktree execution observed | INTEGRATED / #172 GREEN |
| #195 | merged #213 at `3d7042b`; current release `4024add` | #195 characterization and final packet | humble FileManager adapter boundaries | merged #213 | current focused FileManager guards: 17 passed | current release source/tests inspected | ALREADY GREEN / INTEGRATED / #196 CONSUMED |
| #201 | final cleanup contract | `issue-201-final-cleanup-contract.md` | migration-gated deletion/import boundaries | none | owning migration suites and package/health evidence | prerequisites not complete | BLOCKED — accepted migrations |

## Promotion rules

- A packet is not promoted by merge alone; permanent behavior tests and required
  browser/package evidence must be identified.
- Browser `--list` is syntax evidence only.
- Active implementation packets are not re-run or modified by Luna-A.
- Stale staging results are not claimed against the integrated release.
