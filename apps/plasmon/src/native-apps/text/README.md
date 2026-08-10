# Native Text Editor

The editor is a thin `FsService` client. `DocumentSession` owns transient text, autosave, Save As, revision checks, and stale-target protection; it has no persistent database. Save As creates a sibling node and only updates process targeting after creation succeeds. Local dirty content never silently overwrites a changed filesystem revision.
