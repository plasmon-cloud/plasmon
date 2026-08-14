# Luna-C Phase 2 native/runtime master inventory

Audit: 2026-08-13, live GitHub plus `origin/release/0.1.0-r2` (`f4ac3b4`).
This branch is intentionally behind the current integration head and contains no
product implementation. D/Luna-A/Luna-B ownership is recorded, not consumed.

| Issue | state/relevance | exact surface | canonical authority | owner/implementation | permanent tests | Luna packet | missing acceptance | browser? | final disposition |
|---|---|---|---|---|---|---|---|---|---|
| #29 | open, r2 predecessor | boot game seed | bootstrap | historical Games owner | desktopCore/demo tests | prior audit | closure/retirement evidence | no | DEFERRED / accepted retirement; do not restore seed |
| #38 | open, dependency only | Sharing provider | Backend/Sharing | Backend/Coordinator | sharing provider tests | none | MTN provider capability | no | EXCLUDED — Sharing owner |
| #48 | open, r1 runtime | EmulatorJS | Association/OpenService + runtime host | merged PR142 | emulatorjs + package + e2e proof | closure audit | current installed runtime/teardown breadth | yes | CORE RED + EXACT BROWSER-ONLY REMAINDER |
| #58 | open, standalone app | Review.neutron | Review engine/provider + vanilla Neutron | Review implementation integrated | 16 semantic tests + e2e | Phase 2 closure packet | full installed package evidence and criterion map | yes | CORE GREEN + EXACT PACKAGED REMAINDER |
| #64 | open | js-dos progress | FsService + js-dos engine adapter | no eligible owner | none for save lifecycle | save packets | shipped engine API absent from current host; identity/artifact/browser restore | yes | BLOCKED EXTERNAL CAPABILITY / FUTURE OWNER |
| #67 | open | Monaco worker acceptance | installed package Worker | native Apps dependency / #200 A host | packaged edit test, health ledger | worker v2 packet | actual Worker communication, Firefox | yes | CORE RED + EXACT BROWSER-ONLY REMAINDER |
| #79 | open | document close composition | Process/Windowing + Native Apps | D cross-surface owner | focused close tests | dependency only | one production headless workflow | no | ACTIVE D OWNERSHIP — consume dependency |
| #83 | open/blocked | runtime selection | Association/OpenService | D cross-surface owner | separate jsdos/emulator tests | dependency only | composed two-runtime corpus | no | ACTIVE D OWNERSHIP — consume dependency |
| #89 | open | Monaco Program Files path | build + worker adapter + managed root | Luna-C claimed | Program Files/package structural tests | v2 path packet | canonical route and installed worker | yes | VERIFIED FULL RED PACKET + BROWSER REMAINDER |
| #94 | open | video thumbnails | FileManager/Visual | Luna-A | video policy tests | none | real frame extraction | yes | ACTIVE LUNA-A OWNERSHIP |
| #96 | open | native app identity assets | canonical Handler/NativeApp metadata + package asset references | Luna-C claimed | `.red/issue-96` + existing #190 package gate | post-#190 reassessment | six first-party metadata values still generated; shared consumers/fallback ready; installed offline proof remains | partly | FULL/CORE RED + PACKAGE BOUNDARY REMAINDER |
| #107 | open | integrated native acceptance | Testing/Integration master; C evidence | D master | integrated specs | closure audit | native rows rerun installed | yes | D MASTER; C SUB-AUDIT |
| #112 | open r2 | content chrome | Visual + app content surfaces | Luna-C | `issue-112-*` characterization packets | shared semantic contract | integrated #189/#190 boundaries; no truthful structural RED without a visible missing behavior | yes/manual | ALREADY GREEN / RECON COMPLETE |
| #113 | open | Text editor UX | Text + Monaco | Luna-C claimed | document/Monaco tests | full matrix | missing title/commands/minimap; RTL/Monaco visual acceptance | partly | CORE RED + EXACT RTL/BROWSER REMAINDER |
| #114 | open | Markdown UX/formatter | Markdown + Monaco host | Luna-C claimed | render/mode tests | full matrix | formatter/commands and browser interaction | partly | CORE RED + EXACT RTL/BROWSER REMAINDER |
| #121 | open | explicit js-dos fixture | fixture authority + FS/OpenService | Testing/Games historical PR163 | package + demo e2e | closure packet | current release installed journey | yes | CORE GREEN + EXACT PACKAGED REMAINDER |
| #122 | open | Games reference UX | parity evidence | Games/Visual | ledger/docs | reference matrix | direct human/reference evidence | manual | CHARACTERIZATION READY |
| #123 | open | game artwork | shared ResourcePresentation | Luna-C claimed; #190 dependency | generic visual tests | artwork packets | canonical metadata and fixture | yes/manual | WAIT FOR #190/#121 SPECIFIC DEPENDENCY |
| #124 | open/blocked | save screenshots | #64 save artifact + Visual | Luna-C claimed; #64 dependency | none | preview packets | save representation/capture/browser | yes | WAIT FOR #64 SPECIFIC DEPENDENCY |
| #127 | open | live MTN Review sharing | MTN/Review | future Sharing owner | none | boundary audit | authorization/provider integration | yes/no | DEFERRED / NOT MVP |
| #155 | open | Review demo deployment | Testing/Integration | D/testing | manifest/e2e | #121/#58 evidence | current deployment closure | yes | D/testing dependency |
| #170 | open r2 | Review first-demo polish | Review UI/package | Review owner | Review e2e/browser history | closure audit | current package visual/semantic evidence | yes/manual | CORE RED + EXACT PACKAGED/VISUAL REMAINDER |
| #178 | open r2 | MIME/language | FS classifier | Luna-A | #189 integrated tests | prior packet | current consumer adoption | no | ACTIVE LUNA-A OWNERSHIP |
| #180 | open r2 | Photos denied fullscreen | Photos + browser policy | Luna-C claimed | fullscreen helper tests | packaged spec | installed geometry/health | yes | VERIFIED FULL RED PACKET + BROWSER REMAINDER |
| #181 | open r2 | first-demo files/media | bootstrap/testing | D/testing | fixture harness | not consumed | explicit setup | yes | ACTIVE D OWNERSHIP |
| #187 | open r2 | strict browser health | Testing | D/testing | health helper/smoke | closure audit | owner-specific allowance retirement | yes | ACTIVE D OWNERSHIP |
| #200 | open r2 | shared Monaco host | app-side dependency; A architecture | Luna-A | existing model tests | non-authority packet | host refactor | yes | ACTIVE LUNA-A OWNERSHIP |
| #202 | open | js-dos storage sandbox | js-dos vendor/host | implementation blocked | #187 allowance | deep call-chain packet | owner fix, no security weakening | yes | BLOCKED — IMPLEMENTATION OWNER UNAVAILABLE |

No unclassified candidate remains. Browser/packaged rows are not treated as
executed where no local installed session exists. #38 and #127 remain outside
this lane; #79/#83 remain D-owned despite their native/runtime subject matter.
