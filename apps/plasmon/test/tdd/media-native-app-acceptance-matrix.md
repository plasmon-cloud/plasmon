# Media/native-app acceptance matrix

| resource | classification | presentation | open handler | app state | browser API | failure | layer/Issue |
|---|---|---|---|---|---|---|---|
| image | canonical image MIME/ext | Photos/shared image art | Photos association | loading/ready/empty | Blob URL, image decode, optional fullscreen | unsupported/corrupt alert | Bun + packaged #180 |
| audio | media classification | no dedicated first-party audio app found | no independent r2 owner | unsupported/unknown | browser media if later exposed | explicit unsupported | characterization only |
| video | canonical video MIME/ext | Video player/thumbnail | Video association | loading/ready/unsupported | video decode/fullscreen | load/decode/codec alert | Bun + browser #94/#107; #94 Luna-A |
| malformed media | safe fallback | generic/error presentation | normal open failure | error | decode API | actionable alert, no blank | Bun/RTL |
| missing bytes | stable NodeId but read failure | error state | OpenService handler | error/retry if supported | none | no swallowed rejection | headless |
| large resource | resource policy | bounded presentation | normal association | loading/abort/error | bounded browser read/decode | safe fallback | deterministic policy |

No new media framework is proposed. #94 remains Luna-A-owned. Photos fullscreen
is #180; video browser codec evidence remains an #107 closure row.
