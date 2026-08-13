# Photos complete acceptance matrix

| capability | current implementation/test | missing | layer/Issue |
|---|---|---|---|
| open image bytes | FsService + object URL source | live package route | headless/package |
| MIME/extension | `media.ts` + tests | classifier consumer adoption | Bun/#178 |
| fit/actual/zoom/pan | Panzoom actions in component | browser geometry | browser/manual |
| next/previous | adjacent helper + test | keyboard/browser sibling journey | RTL/browser |
| load/decode error | image `onError` alert | installed decode fixture | browser |
| unsupported image | async infer error | semantic RTL error | RTL |
| Expand denied/restore | helper + component fallback | installed policy geometry | #180 browser |
| viewport/narrow/large | CSS contain/flex | real geometry | browser/manual |
| object URL lifecycle | lease test | unmount/reload browser | browser |
| context/focus/keyboard | root keydown, tabIndex | semantic RTL | RTL |

No new image framework or fullscreen permission is implied.
