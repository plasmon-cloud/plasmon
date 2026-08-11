# Native Markdown

`native:markdown` uses the same `FsService`/`DocumentSession` persistence mechanics as Text, Monaco for source editing, Marked for Markdown/GFM parsing, and DOMPurify for sanitization before sanitized HTML reaches React. Edit/Split/Preview mode changes keep the Monaco model mounted so editor history is preserved.
