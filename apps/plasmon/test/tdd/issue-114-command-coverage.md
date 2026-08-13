# #114 command coverage

| command | Markdown owner | current state | gate |
|---|---|---|---|
| Edit/Split/Preview | MarkdownEditor | buttons/pressed state | existing model test + RTL |
| Save/Ctrl+S | shared Text/session adapter | Save + capture keydown | shared tests; RTL |
| Format document | Markdown | absent | RED |
| Find/Replace/Go to Line | shared Monaco/Text command surface | absent | #113/#114 RED |
| preview sanitization | Markdown renderer | present | Bun GREEN |
| close Save/Discard/Cancel | shared DocumentCloseModel | present | Bun GREEN, #79 composed |

Visible command acceptance must assert user-facing semantics, not internal
Monaco command IDs or incidental DOM nesting.
