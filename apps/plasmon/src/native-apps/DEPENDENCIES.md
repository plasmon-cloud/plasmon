# Agent 7 dependency requests

The Wave 2 implementation works without new packages.

Future polish requests, not blockers:

- `monaco-editor`: richer Text/Markdown editing, search, selection, accessibility, and language services.
- `marked`: broader CommonMark-compatible Markdown rendering.
- `dompurify`: sanitizer for a future richer HTML-producing Markdown pipeline.
- No media library is required for the current native `<video>` + narrow YouTube adapter. A future Video.js-style dependency should be evaluated only if native controls prove insufficient.
