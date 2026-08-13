# Luna-A RED promotion ledger

This lane-local ledger complements Luna-D's master ledger. Refresh:
integrated `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

| Issue | Validated packet commit/file | RED/spec files | Behavioral contract | Implementation PR | Permanent test expected | Permanent test observed | Promotion status |
|---|---|---|---|---|---|---|---|
| #44 | Phase-2 audit current HEAD `8453df4` | `issue-44-closure-audit.md` | canonical shortcut, NodeId, collision/open lifecycle | none | `create-shortcut.test.tsx`, fs/refactor guards | observed/source inspected | CORE GREEN / ACCEPTANCE GAP |
| #51 | prior packet commit `d522336` | active packet files | Send to Desktop shortcut consumer | #210 active | PR #210 tests | active PR not consumed | ACTIVE — DO NOT TOUCH |
| #65 | prior packet commit `d522336` | active packet files | import/paste operation state | #208 active | PR #208 tests | active PR not consumed | ACTIVE — DO NOT TOUCH |
| #66 | repaired packet `789279e`/`6eb5cc5` | existing #66 browser spec | drag preview stacking/hit/drop/cancel | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #86 | repaired packet `6eb5cc5` | existing #86 browser spec | diagnostic selection/drag distinction | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #93 | Phase-2 current HEAD | existing spec + `issue-93-browser-geometry-spec.md` | rendered aspect-ratio containment | none | polish/Visual tests + packaged geometry | pure tests observed; browser blocked | BROWSER SPEC ONLY |
| #94 | Phase-2 current HEAD | three contract docs | bounded video still lifecycle | none | future thumbnail adapter tests | no production seam | BROWSER SPEC ONLY / REFACTOR RED GAP |
| #95 | prior repaired packet | existing browser spec | selected label overlay geometry | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #108 | Phase-2 current HEAD | `issue-108-closure-audit.md` | Explorer history model | none | navigation/file-manager tests | observed green | CORE GREEN / BROWSER GAP |
| #110 | prior packet + Phase-2 contract | existing browser spec + contract | Fs-backed hidden preference | none | pref/visibility tests | observed green; browser blocked | BROWSER SPEC ONLY |
| #171 | Phase-2 current HEAD | installed spec + budget contract | bounded Element icon requests | none | resolver tests | observed deterministic green; browser blocked | BROWSER SPEC ONLY |
| #45 | closure audit | `issue-45-closure-audit.md` | Native Recycle Bin projection and canonical Trash actions | integrated `17ef2c1` | model/filesystem closure test | packaged session journal absent | ALREADY GREEN core / browser pending |
| #172 | existing composed packet | `issue-172.composed.red.test.ts` | Trash restore collision | #192 integrated dependency | composed regression at integrated head | stale lane intentionally fails overlap | WAIT FOR STAGING REFRESH |
| #173 | prior repaired packet | existing List spec | compact spatial List | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #174 | prior packet | existing Search RED | single canonical `.sys` projection | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #175 | Phase-1/2 current | geometry spec | stable Search geometry | none | packaged browser geometry | syntax listed; execution blocked | BROWSER SPEC ONLY |
| #178 | Phase-2 current | authority/precedence/consumer maps + integrated closure audit | shared MIME/language semantics | #189 integrated | `test/refactor/189/issue-189.test.ts` and consumer imports | release evidence/source inspected; stale lane cannot execute | ALREADY GREEN — COMPLETE CORE ACCEPTANCE |
| #182 | prior packet | existing core/RTL packet | root/Favorites inventory | today's ownership | implementor promotion | not re-run | ACTIVE — DO NOT TOUCH |
| #190 | prior packet | active presentation spec | package asset identity | #211 active | PR #211 tests | active PR not consumed | ACTIVE — DO NOT TOUCH |
| #191 | prior packet | active FileEntry packet | Desktop FileEntry pilot | #204 active | PR #204 tests | active PR not consumed | ACTIVE — DO NOT TOUCH |
| #192 | integrated dependency | #172 composed closure | Desktop placement controller | merged #205 | release #192 tests | release source inspected; stale lane not executable | INTEGRATED / COMPOSED GAP |

## Promotion rules

- A packet is not promoted by merge alone; permanent behavior tests and required
  browser/package evidence must be identified.
- Browser `--list` is syntax evidence only.
- Active implementation packets are not re-run or modified by Luna-A.
- Stale staging results are not claimed against the integrated release.
