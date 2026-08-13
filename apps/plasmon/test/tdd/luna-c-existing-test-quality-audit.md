# Luna-C existing-test quality audit

| area | current test/evidence | quality finding | disposition |
|---|---|---|---|
| DocumentSession | `text/document.test.ts` | production FS/session semantics, failures/conflicts covered | strong Bun baseline; add #179 default-off RED |
| Monaco | `text/monacoAdapter.test.ts` | label/path and model ownership only | valid characterization, not worker proof |
| packaged Monaco | `plasmon-monaco-packaged.spec.ts` | visible ready marker + edit/save/reopen | extend with Worker observability; marker alone rejected |
| Monaco smoke | `plasmon-refactor-smoke.spec.ts` | real package journey with scoped #67 allowances | useful smoke; allowances must remain narrow |
| Photos fullscreen | `photos/fullscreen.test.ts` | denied/rejected helper behavior | valid lower layer; not installed policy proof |
| Photos browser | no dedicated installed #180 gate found | fallback containment/health absent | browser spec only |
| Video | `video/media.test.ts` | MIME/support/error/object URL helpers | valid deterministic policy; codec decode is browser boundary |
| js-dos | `jsdos.test.ts`, demo game specs | association/package/canvas readiness | canvas is not storage health; #202 remains RED |
| EmulatorJS | `emulatorjs.test.ts`, packaged proof | host/config/real runtime evidence | keep runtime health separate from js-dos |
| Markdown | `markdown.test.ts`, packaged Monaco | mode/render semantics and editor journey | formatter/command acceptance absent (#114) |
| source assertions | package/build tests | package structure is appropriate for package contract | never treat as runtime readiness |

Rejected designs: fake Worker construction, canvas-exists-as-ready, swallowed
page errors, arbitrary sleeps as health, source-only acceptance, browser tests
that simulate fullscreen policy, and test-local replacement of production FS /
Association/OpenService. No test files owned by active implementors were
modified by this audit.
