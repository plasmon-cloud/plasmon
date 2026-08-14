# Luna-C r2 Native Apps / Editors / Media / Runtime inventory

Audit date: 2026-08-13. Authority: live GitHub Issues/PRs plus the integrated
`release/0.1.0-r2` checkout. The worktree is on `tdd/r2/luna-c-apps`; it is
behind the current release head (`git merge-base --is-ancestor` is false), so
future implementation state must be reconciled before promotion.

| Issue | title | target | app/runtime | authority | open PR? | Luna owner? | dependency | C disposition |
|---|---|---|---|---|---|---|---|---|
| #48 | EmulatorJS second runtime | r1/open | EmulatorJS | Association/OpenService + runtime host | none (PR142 merged) | no | packaged runtime assets | CLOSURE AUDIT: r1 implementation exists; r2 packaged parity remains evidence work |
| #64 | Filesystem-backed js-dos progress persistence | unmilestoned/open | js-dos | runtime host + FsService save artifact | none | Luna-C claimed | actual shipped js-dos save API and stable NodeId artifact | HARNESS GAP / blocked external capability |
| #67 | Packaged Monaco acceptance | unmilestoned/open | Text/Markdown/Monaco | installed package/browser Worker | none (PR131 is r1 merged) | dependency of #200 | #89 path, #187 health | PACKAGED BROWSER SPEC ONLY |
| #83 | Headless runtime selection | unmilestoned/open/blocked | js-dos + EmulatorJS | AssociationRegistry/OpenService | none | Luna-C reconciliation | handler registration | ALREADY GREEN / RECON COMPLETE; engine startup remains browser boundary |
| #89 | Monaco workers under canonical Program Files path | unmilestoned/open | Monaco | Program Files/bootstrap + package adapter | none | yes (queue) | #200 consumes path | VERIFIED FULL RED PACKET + exact installed Worker/browser remainder |
| #94 | Bounded video thumbnails | unmilestoned/open | Video/FileManager | FileManager/Visual/browser media | none | Luna-A canonical | shared presentation | ACTIVE OWNERSHIP — DO NOT TOUCH (Luna-A) |
| #96 | Packaged native application identity assets | unmilestoned/open | first-party native apps | canonical Handler/NativeApp metadata + Visual seam | none | yes (queue) | package outputs / #190 consumer seam | FULL/CORE RED + PACKAGE BOUNDARY REMAINDER |
| #107 | Integrated packaged baseline | unmilestoned/open | all installed native/runtime surfaces | Testing/Integration | none | no; Testing primary | current installed environment | CLOSURE AUDIT |
| #112 | Shared first-party native-app chrome | r2/open | all first-party native apps | Visual primitives + app-owned content chrome | none | Luna-C disposition | #190/#201 and app migrations | ALREADY GREEN / RECON COMPLETE — characterization only |
| #113 | Text Monaco desktop-editor parity | unmilestoned/open | Text | Text app + Monaco adapter | none | Luna-C claimed | #67/#89/#178 | HARNESS GAP for RTL Monaco mount; exact packaged/browser remainder |
| #114 | Markdown formatter/commands | unmilestoned/open | Markdown | Markdown app + shared Monaco host | none | Luna-C claimed | #67/#112/#113 | HARNESS GAP for RTL Monaco mount; exact packaged/browser remainder |
| #121 | Explicit packaged js-dos fixture | unmilestoned/open | Games/js-dos | Testing fixture + normal filesystem/open path | PR163 merged | no | #64/#107 | CLOSURE AUDIT |
| #122 | daedalOS game UX audit | unmilestoned/open | Games | parity evidence ledger | none | yes (domain research) | #48/#64/#121 | CHARACTERIZATION READY |
| #123 | Game artwork thumbnails | unmilestoned/open | Games/Visual | shared ResourcePresentation | none | Luna-C claimed | #121/#190 | HARNESS GAP: game-artwork metadata contract absent |
| #124 | Game save screenshot thumbnails | unmilestoned/open/blocked | Games/runtime + Visual | #64 save artifact + shared presentation | none | Luna-C claimed | #64 | HARNESS GAP: save artifact/boundary absent |
| #178 | Canonical MIME/language inference | r2/open | FS/Associations/Editors | classifier seam | PR207 merged | Luna-A prep/owner | #189 integrated | ACTIVE OWNERSHIP — DO NOT TOUCH (Luna-A) |
| #179 | Autosave explicit opt-in | r2/open | Text/Markdown | DocumentSession + settings | none | explicit task owner | #41/#42 | VERIFIED FULL RED PACKET |
| #180 | Photos expand under denied fullscreen | r2/open | Photos | Photos view + browser policy | none | explicit task owner | #107 evidence | BROWSER SPEC ONLY |
| #181 | First-demo document/media fixtures | r2/open | bootstrap/testing | Testing/Integration | none | no; Testing primary | #167/#121 | ACTIVE OWNERSHIP — DO NOT TOUCH |
| #187 | Refactor guard smoke | r2/open | packaged health | Testing/Integration | PR188 merged | no | #167 | CLOSURE AUDIT; retain narrowly scoped allowances |
| #200 | Shared Monaco browser host | r2/open | Text/Markdown | Luna-A architecture owner | none | Luna-A canonical | #67/#89/#189 | FINAL PACKET READY — implementation remains Luna-A |
| #202 | js-dos storage bootstrap | unmilestoned/open | js-dos | runtime/browser sandbox | none; owner unavailable | no implementor permitted | #187 allowance | BLOCKED — IMPLEMENTATION OWNER UNAVAILABLE DURING ACTIVE REFACTOR PROGRAM |

Discovery also found no open r2 Issue whose primary authority is an independent
Audio surface. Browser, Properties, Explorer, Settings, and Video are audited
below as consumers; no competing implementation Issue was claimed. #38/#58 are
Sharing/Review and remain outside this lane. #94/#178/#181/#200 and all listed
Luna-A/Testing ownership are recorded rather than consumed.
