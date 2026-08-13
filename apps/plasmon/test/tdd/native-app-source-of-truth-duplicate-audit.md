# Native-app source-of-truth duplicate audit

| duplicate/risk | locations | classification |
|---|---|---|
| MIME/extension tables | classifier + editor/media helpers | #178 canonical consumer migration; app-specific MIME capability helpers legitimate |
| app icons | HandlerDefinition/NativeAppDefinition + shared Visual assets | #96 owns six first-party identity references; #190 owns consumption/fallback; current generated glyph metadata is FULL/CORE RED |
| process/window state | Process/Windowing plus Shell projections | B-owned; app must not duplicate |
| filesystem paths as identity | document target/path and runtime paths | NodeId/session is authority; path only presentation |
| runtime catalogs | two explicit runtime definitions | legitimate distinct handlers; no game dispatcher |
| Worker routes | build.ts + monacoEnvironment + package tests | #89 migration; one mapping currently |
| localStorage | Review/Emulator child probes and Plasmon tests | Review background persistence; Emulator masks; no Plasmon foreground authority |
| app registry | NativeApplicationRegistry/content definitions | canonical; no app-local catalogs |
| Markdown language literal | MarkdownEditor `language="markdown"` vs classifier | #178/#200 app-specific known risk |
| runtime logical vs transport paths | Program Files + runtime mirrors | legitimate documented adapter, must remain byte-equivalent/local |

No production fix made. #201 cleanup may remove legacy references only after
reachability and package evidence, not by source grep alone.
