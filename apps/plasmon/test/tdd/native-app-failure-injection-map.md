# Native-app failure injection map

| seam | existing injection vocabulary | consumers/tests |
|---|---|---|
| Fs read/stat/write | FsService implementations/test repository; `failWrites` in TinyFs | Text/FS tests |
| association | registered rules/unknown handler | association tests |
| Process loader | NativeApplicationRegistry loader rejection | process tests |
| Window allocation | NativeProcessController/window manager failure | process tests |
| Worker construction | browser-only real Worker/request failure; no fake packaged proof | #67/#89 |
| Monaco model | adapter create callback in Bun | model tests |
| image/video object URL | ObjectUrlApi lease | media tests |
| media decode | real `<img>/<video>` events | browser only |
| iframe | real onLoad/onError/sandbox | browser only |
| runtime startup | package asset/request/runtime callbacks | browser e2e |
| js-dos save/import | seam absent in current host | #64 RED |
| EmulatorJS child message | token/timeout/error path in host | browser lifecycle |
| Process close | ProcessCloseRequest callbacks | documentClose tests |
| Review persistence | MemoryReviewPersistence and injected port | Review engine tests |

Do not add test-only APIs to production solely to manufacture a failure. Missing
injection seams are documented as future owner work, not harness gaps when the
claim is genuinely browser/package-bound.
