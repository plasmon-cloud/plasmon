# Markdown document-session exhaustive matrix

Markdown uses the same Session/Process close/save path as Text. Shared cases
must not receive duplicate policy tests; Markdown-specific rows remain here.

| case | authority | evidence/gap | layer |
|---|---|---|---|
| open/new/edit/save/dirty/close/reopen | shared DocumentSession/Process | shared Text tests; #179 RED applies both | Bun/headless |
| Edit/Split/Preview | MarkdownEditor | `markdown.test.ts` mode model | RTL/browser narrow layout |
| source -> preview update | Markdown renderer + editor | renderer tests; no live adapter test | RTL |
| formatter success/failure | Markdown app | formatter absent | #114 RED Bun/RTL |
| sanitized/malformed/unsafe | Marked+DOMPurify | markdown tests | Bun/RTL |
| language/title/status | host + Markdown UX | title/command gaps | #114/#200 |
| external update/conflict | shared Session | document conflict tests | Bun |
| close Save/Discard/Cancel | shared DocumentCloseModel | shared tests | headless |
| narrow/focus/keyboard | Window/browser adapter | no stable full proof | packaged/browser |
