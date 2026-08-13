# Native-app packaged asset master inventory

| app/runtime | asset | source | package output/URL | authority | offline/permanent test | browser claim |
|---|---|---|---|---|---|---|
| all | main JS/CSS | `src/index.tsx`, styles | `dist/web/main.js`, `main.css` | build | package guard | boot |
| Text/Markdown | Monaco CSS/engine | node_modules + build | main/CSS + worker outputs | #89/#200 | packaging tests | editor/Worker |
| Text/Markdown | five Workers | build.ts | `dist/web/monaco-workers/*` current | #89 | package test | actual Worker |
| Photos/Video | app code | native-apps source | main bundle/chunks | app/build | package loader test | media/decode |
| Browser | app code | Browser.tsx | main bundle | Browser | package loader | iframe/sandbox |
| Settings/Explorer/Properties/Recycle | app code/CSS | native source/public | main/chunks/public SVG | app/Visual | package loader tests | rendered semantics |
| js-dos | JS/CSS/WASM | pinned install in build | Program Files + runtime mirror | runtime/#202 | package test | player/canvas/storage |
| EmulatorJS | host/JS/CSS/core/compression | pinned install/public | Program Files + runtime mirror | runtime/#48 | package test | iframe/WASM/canvas |
| identity assets | SVGs | `public/static/plasmon/icons` | copied static package | #96/#190 | package asset tests | path/visual |
| fixtures | js-dos/ROM | generated legal fixture | `fixtures/`, Games paths | #121/#48 | package fixture tests | installed launch |

No fonts or remote assets are currently declared by native apps. Exact final
Monaco output and asset paths remain #89 implementation work.
