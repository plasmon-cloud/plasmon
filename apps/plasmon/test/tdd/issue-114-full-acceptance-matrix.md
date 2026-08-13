# #114 full acceptance matrix

| criterion | current actual/evidence | final disposition |
|---|---|---|
| title/editor identity | Markdown sets filename or Markdown; no accepted Monaco identity | deterministic RED |
| Edit/Split/Preview | `MARKDOWN_MODES`, visibility test, packaged e2e | GREEN lower layer |
| preview update | source feeds MarkdownPreview; renderer tests | RTL live update gap |
| safe output/malformed | Marked + DOMPurify tests | GREEN lower layer |
| formatter action | no formatter button/provider | full deterministic RED |
| useful Monaco commands | no visible command menu | RTL/browser RED |
| dirty/save/close/reopen | shared Session/close/package tests | preserve; #179 applies |
| empty document | session/editor path | RTL characterization |
| narrow layout/focus/keyboard | split flex panes, no acceptance test | browser/manual boundary |
| external update/conflict | shared session | Bun GREEN |

Do not count sanitizer tests as formatter UI evidence. Markdown preview/formatter
remain app-owned, outside #200 host architecture.
