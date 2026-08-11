# Agent 7 mature-component dependencies

Wave 2 polish intentionally replaces homemade application engines with established browser components while preserving Plasmon's OS/service adapters.

Runtime dependencies:

- `monaco-editor@0.54.0` — Text and Markdown editing engine: undo/redo, find, selection/cursor behavior, language modes, accessibility, and text-model semantics. Pinned to 0.54.0 for the current esbuild packaging path rather than adopting the newer Monaco export reorganization during this gate.
- `marked@18.0.7` — mature Markdown/GFM parser used for Preview. It is not treated as a sanitizer.
- `dompurify@3.4.12` — sanitizes Marked HTML before the preview uses `dangerouslySetInnerHTML`; Plasmon also applies a narrow URL protocol policy.
- `@panzoom/panzoom@4.6.2` — Photos pan/zoom engine, avoiding a custom pointer/gesture implementation.

No application engine is loaded from a CDN. Monaco language/editor workers are emitted by `apps/plasmon/build.ts` into the packaged application.

Video remains on browser-native `<video controls>` plus the existing narrow YouTube adapter. Video.js was reviewed but is not added in this round because it would materially increase the media stack without fixing a demonstrated Plasmon gate regression.
