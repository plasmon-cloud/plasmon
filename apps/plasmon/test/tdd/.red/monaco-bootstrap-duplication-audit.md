# Monaco bootstrap duplication audit

| Concern | File | Current finding | Duplicate? | Migration owner | Do-not-touch reason |
|---|---|---|---|---|---|
| worker label -> file | `text/monacoEnvironment.ts::monacoWorkerFile` | one current mapping | shared candidate | #200/#89 | preserve supported Monaco labels |
| `MonacoEnvironment` install | `text/monacoEnvironment.ts` | one global install guard | no current Text/Markdown duplicate | #200 | browser global contract |
| worker URL | `text/monacoEnvironment.ts` | `./monaco-workers/<file>` relative URL | path defect/legacy | #89 | package path migration |
| worker emit entries | `build.ts` | five `monaco-workers/*` outputs | one build table, divergent root | #89 | package bytes/manifest ownership |
| dynamic Monaco import | `MonacoEditorSurface.tsx` | one shared surface import | no duplicate | #200 | host candidate |
| model creation | `MonacoEditorSurface.tsx` | per-surface owner + URI | no duplicate | #200 | preserve model isolation |
| model disposal | same | exact owned model dispose | no duplicate | #200 | avoid cross-surface disposal |
| language assignment | same | createModel language + setModelLanguage effect | lifecycle duplication within one host | #200 | preserve updates |
| editor create/dispose | same | one React effect | no second Text/Markdown implementation | #200 | browser lifecycle |
| loading/error | same | `loading`, `error`, readiness marker | shared candidate | #200 | explicit failure state |
| Text language derivation | `text/editorModel.ts` | extension table | duplicate semantic table | #178/#200 | do not delete before #178 |
| Markdown language | `markdown/MarkdownEditor.tsx` | literal `markdown` | separate language source | #178/#200 | Markdown contract still valid but should consume canonical hint |
| worker tests | `text/monacoAdapter.test.ts` | pure label/path tests | characterization | #89/#200 | update only after path integration |

## Exhaustive search result

Search found one actual Monaco environment installer and one shared rendered
surface. The major duplication is not two bootstraps; it is Text's extension
language table versus Markdown's literal language and the build/runtime path
exception. Do not invent a second host or remove the current installer before
both apps migrate.
