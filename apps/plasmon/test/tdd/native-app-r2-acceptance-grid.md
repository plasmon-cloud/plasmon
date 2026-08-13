# Native app r2 acceptance grid

Legend: **P** permanent evidence exists; **R** RED/missing; **B** browser/manual
boundary; **D** dependency/other lane. Paths name the strongest current test.

| app | discovery/.sys/identity | presentation/Search/Start/Open With/Properties | process/window/title | states/errors | keyboard/context/a11y | reopen/persistence/mutation | package/browser | owner |
|---|---|---|---|---|---|---|---|---|
| Text | P `desktopCore`, activation | R #113; handlers feed shared projections | P process tests; R title parity | P session tests; R deleted-resource UI | R #113; B Monaco focus | P save/reopen; R rename/delete corpus | B #67/#89 | C |
| Markdown | P associations | R #114 | P lifecycle; R title | P renderer/session; R formatter | R commands/focus | P session; R external mutation matrix | B #67 | C |
| Photos | P associations/.sys | R #112/#180 | P Process; B visible title/geometry | P helper; B decode/fullscreen | R RTL; B keyboard/zoom | B resource change/restore | B browser media | C |
| Video | P association | R #112; D #94 thumbnails | P Process; B playback | P helper; B codec/decode | R native control/a11y | B stale/teardown | B codec/object URL | C/A |
| Browser | P `.sys`/URL | P URL tests; B iframe UI | P Process; B navigation title | P URL failures; B foreign iframe | R RTL/context boundary | B close/reopen/target | B sandbox/iframe | C/#176 |
| Settings | P `.sys`/loader | R identity/chrome | P singleton; P title | P storage unavailable model | R RTL/theme | P Fs-backed consumers where wired | P package; B visual | C |
| Explorer | P `.sys`/loader | D A-owned FileManager | P Process/title | P navigation/errors | D A-owned interaction | P NodeId history | P package; B layout | A |
| Properties | P `.sys`/loader | D A-owned panel/#178/#190 | P Process/title | R missing-resource visual | D panel semantics | R mutation while open | P package; B visual | A/C boundary |
| Recycle Bin | P `.sys`/loader | P model; B visual | P singleton | P model/error/status | R deep RTL | P Trash persistence | P package; B visual | C/A |
| js-dos | P runtime association/no `.sys` | D shared runtime presentation | P headless open | B real ready; R #202 storage | B input/audio | R #64 save; P URL cleanup | B script/WASM/canvas | C |
| EmulatorJS | P association/no `.sys` | D shared runtime presentation | P headless open | B real iframe ready/error | B input/audio/fullscreen | B teardown; save unsupported | B iframe/WASM/core | C |

Grid deliberately does not turn source/package structural tests into user
acceptance. D/A-owned cells are dependencies rather than competing RED packets.
