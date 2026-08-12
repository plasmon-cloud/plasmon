# Recycle Bin

`native:recycle-bin` is the first-class Plasmon surface for filesystem Trash operations.

## Authority boundary

The application consumes the `filesystem.trash` facade created by `createFilesystemCore()`. That facade delegates to the canonical filesystem `TrashService`, which alone owns `/System/.Trash` wrapper metadata, restore destination/fallback behavior, collision naming, permanent deletion policy, and empty semantics.

The UI must not list `/System/.Trash`, parse `plasmon.trash` metadata, or mutate wrapper nodes directly. Display rows are projections of `TrashService.list()` results only.

Filesystem events are invalidation signals. The app re-reads `TrashService.list()` after relevant user actions and `FsEventSource` notifications rather than maintaining an independent Trash database.

## User operations

- **Restore** uses canonical original-parent, Desktop fallback, and collision behavior while preserving the trashed node identity.
- **Delete permanently** is an explicit selected-item action and requires confirmation in the browser surface.
- **Empty Recycle Bin** is explicit, confirmed, and delegates to `TrashService.empty()`.

Ordinary FileManager Delete routing and Neutron uninstall are outside this application.

## Testing

`model.test.ts` uses the shared headless Plasmon environment so list/restore/permanent-delete/empty exercise production filesystem semantics. Browser coverage should prove the real native app can be opened/rendered through packaged Plasmon; ordinary delete-to-trash browser journeys belong with the FileManager delete integration that feeds Trash.
