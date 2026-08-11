# Native Text Editor

`native:text` is a Plasmon adapter around Monaco Editor. File identity and persistence remain exclusively in `FsService`/`DocumentSession`; Monaco owns the in-memory editing model, undo/redo, find, cursor and selection behavior. Normal saves never recreate or reset the model. Explicit reload after an external conflict may replace model content.
