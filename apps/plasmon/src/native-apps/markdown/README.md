# Native Markdown

Markdown reuses the Text editor's transient `DocumentSession` and `FsService` save/conflict rules. Preview is dependency-free and intentionally limited: it builds React element data from headings, paragraphs, lists, fenced/inline code, emphasis, and validated links. Raw HTML is never passed to `dangerouslySetInnerHTML` and remains plain text.
