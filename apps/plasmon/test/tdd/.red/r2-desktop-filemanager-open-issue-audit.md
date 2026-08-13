# r2 Desktop/FileManager/Visual open-Issue audit

Final remote refresh: release `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
Open implementation ownership observed: #51 PR #210, #65 PR #208, #189 PR #207,
#191 PR #204. #186 PR #209 is merged. #192/#205 is integrated.

| Issue | Current integrated evidence | Luna-A disposition / gap |
|---|---|---|
| #51 | canonical shortcut helper green; Send-to-Desktop consumer not on release | VERIFIED CORE RED / INCOMPLETE; PR #210 owns implementation |
| #65 | import/paste are still opaque on release | VERIFIED CORE RED / INCOMPLETE; PR #208 owns implementation |
| #66 | source DOM drag transforms; no top-level preview on release | BROWSER SPEC ONLY; repaired stack/hit/drop/cancel gate |
| #86 | diagnostic text inherits FileManager nonselection | BROWSER SPEC ONLY; Selection API gate |
| #92 | move path has no shared operation state | WAIT FOR DEPENDENCY on #65 |
| #93 | shared containment/lifecycle deterministic evidence green | CHARACTERIZATION ONLY; visual browser gate pending |
| #94 | no FileManager video frame-extraction seam | IMPLEMENTATION SPECIFICATION / BROWSER BOUNDARY; not executable RED |
| #95 | selected overlay behavior exists but dedicated browser acceptance absent | BROWSER SPEC ONLY; separate from #191 |
| #108 | Explorer history model and guards green | CHARACTERIZATION ONLY |
| #110 | filesystem preference/filtering green | BROWSER SPEC ONLY; packaged toggle/reload pending |
| #115 | no bounded shared command layer with two consumers | CHARACTERIZATION ONLY / IMPLEMENTATION REQUIRED |
| #169 | Start reconciliation prerequisite for #194 | readiness dependency, no Luna-A full packet |
| #171 | deterministic Neutron resolver green; installed no-storm unexecuted | BROWSER SPEC ONLY; distinct from #190 |
| #172 | #192 integrated; composed Trash/placement gate staged | BROWSER SPEC ONLY / closure pending exact integrated run |
| #173 | current List remains vertical full-width | VERIFIED CORE RED / INCOMPLETE; repaired multi-column spatial gate |
| #174 | current Search emits native plus raw `.sys` result | VERIFIED CORE RED / INCOMPLETE; lower characterizations added |
| #175 | Search frame geometry remains a separate browser acceptance defect | SPEC GAP; referenced by #193 readiness, no duplicate Luna-B full packet |
| #176 | no production context ownership seam | RECONNAISSANCE |
| #178 | accepted classifier is on open #189 PR, not release | WAIT FOR DEPENDENCY |
| #182 | release bootstrap still creates Downloads; Explorer Favorites hard-coded | VERIFIED CORE RED / INCOMPLETE; actual Explorer projection gate added |
| #186 | Testing Lead persistence PR merged | HANDOFF INPUT FOR TESTING LEAD; no Luna ownership |
| #189 | open implementation PR and prior RED evidence | WAIT FOR DEPENDENCY |
| #190 | Plasmon asset constants still request root `/static` path | BROWSER SPEC ONLY / REAL DEFECT; strict-health gate repaired |
| #191 | open implementation PR; current release not migrated | WAIT FOR DEPENDENCY |
| #192 | integrated controller owns placement policy | CHARACTERIZATION ONLY; closure evidence tracked in #172 audit |
| #193 | Search remains inline; source convergence incomplete | RECONNAISSANCE / readiness |
| #194 | Start remains inline; #169 prerequisite incomplete | RECONNAISSANCE / readiness |
| #195 | broad adapter still active; no truthful architecture RED | CHARACTERIZATION ONLY; refresh after #191 |
| #196 | final view seam architecture-dependent | WAIT FOR DEPENDENCY on #195 |
| #201 | cleanup candidates remain active until migrations integrate | RECONNAISSANCE / readiness |

## Browser-claim replacement audit

Source/CSS-only claims were replaced or quarantined as follows:

- #66 -> real pointer drag, overlapping native window, temporary stack hit probe,
  transparent `elementFromPoint`, destination drop and cleanup.
- #86 -> real `window.getSelection()` range plus drag distinction.
- #93 -> natural image dimensions, actual contained frame and three aspect classes.
- #95 -> actual overlay/editor bounds, sibling overlap/hit testing and edge drag.
- #110 -> real toggle, reopen and app-frame reload.
- #173 -> actual rendered x-columns, widths and spatial ArrowRight.
- #190 -> resolved installed request response and strict health accounting.

No exact pixels, z-index numbers, line counts or source-shape architecture
assertions are used as acceptance substitutes.
