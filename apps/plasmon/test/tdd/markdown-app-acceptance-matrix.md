# #114 Markdown acceptance matrix

| behavior | authority | observable contract | layer | disposition |
|---|---|---|---|---|
| open/new/title/identity | FS/OpenService/Process + Markdown | target NodeId, filename-aware title | headless/RTL | session works; title parity incomplete |
| Edit/Split/Preview | Markdown app | semantic mode changes; source updates preview | RTL + browser visual | current mode model is characterized |
| sanitized preview | Markdown renderer | safe semantic output; malformed source does not crash | Bun/RTL | render tests exist; do not assert incidental DOM |
| formatter | Markdown app + deterministic formatter | visible action, deterministic output, dirty/save participation; failures preserve text | Bun/RTL/browser command | currently absent: RED |
| Monaco commands | shared editor host/Text chrome | useful commands discoverable, shortcuts retained | RTL + packaged | currently absent: RED |
| Save/dirty/close/reopen | shared DocumentSession/Process | same as Text; #179 policy applies | Bun/headless/package | lower semantics exist |
| narrow window | Windowing/browser layout | both panes/control semantics remain usable | packaged browser/manual | genuine browser/layout boundary |
| malformed/external update | renderer/session | alert or safe fallback; conflict does not overwrite | Bun/RTL | preserve current sanitizer/conflict evidence |

Markdown preview and formatter remain Markdown-owned. #200's Monaco host only
owns browser/editor lifecycle and must not own preview, formatting, or split
mode. Exact rendered HTML structure is intentionally unspecified.
