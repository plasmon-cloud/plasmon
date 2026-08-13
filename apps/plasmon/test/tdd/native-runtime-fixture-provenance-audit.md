# Native/runtime fixture provenance audit

| fixture | provenance | current package/path | setup authority | browser suitability | owner |
|---|---|---|---|---|---|
| Text/Markdown | generated empty/user-created docs | FileManager create in installed journey | canonical FS/OpenService | Monaco edit | #67/#113/#114 |
| image | no stable current authored image fixture in Plasmon package | explicit #181 setup required | Testing fixture flag | Photos decode/fullscreen | #181/#180 |
| video | no stable current legal decode fixture identified | explicit setup required | Testing | native codec | #94/#107 |
| js-dos demo | generated redistribution-safe bundle | `dist/web/fixtures/PlasmonDemo.jsdos` | `plasmon-fixture=demo-game` | player/canvas | #121 |
| Doom historical | package proof asset may exist in Games tests, old boot seed retired | not normal boot | explicit test only | js-dos | #121/#29 |
| NES | generated mapper-0 legal proof ROM | `Games/Test ROMs/PlasmonTest.nes` | package asset | EmulatorJS | #48 |
| Review | authored structured review workflow | independent `apps/review` package | vanilla Neutron install | app/Files/reload | #58/#170 |

No copyrighted media/game download is introduced. Missing image/video fixtures
are a Testing/#181 dependency, not fabricated here.
