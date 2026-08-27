# Recycle Bin


`native:recycle-bin` is the first-class Plasmon surface for filesystem Trash operations.

## Authority boundary

The application consumes the `filesystem.trash` facade created by `createFilesystemCore()`. That facade delegates to the canonical filesystem `TrashService`, which alone owns `/System/.Trash` wrapper metadata, restore destination/fallback behavior, collision naming, permanent deletion policy, and empty semantics.

The UI must not list `/System/.Trash`, parse `plasmon.trash` metadata, or mutate wrapper nodes directly. Display rows are projections of `TrashService.list()` results only.

Filesystem events are invalidation signals. The app re-reads `TrashService.list()` after relevant user actions and `FsEventSource` notifications rather than maintaining an independent Trash database.

## User operations

- **Restore** uses canonical original-parent, Desktop fallback, and collision behavior while preserving the trashed node identity.
- **Delete permanently** is an explicit selected-item action and requires confirmation in the native surface.
- **Empty Recycle Bin** is explicit, confirmed in the native surface, and delegates to `TrashService.empty()`.

Destructive confirmation is rendered inside Recycle Bin. Installed Plasmon must not depend on `window.confirm` or broader Neutron sandbox/modal permission for these operations.

Ordinary FileManager Delete routing and Neutron uninstall are outside this application.

## Testing

`model.test.ts` uses the shared headless Plasmon environment so list/restore/permanent-delete/empty exercise production filesystem semantics. RTL coverage protects the native confirmation adapter against browser-modal dependence. Packaged browser coverage creates a real Trash entry through FileManager, launches Recycle Bin through the Shell/process/window path, confirms Empty, and proves canonical Trash becomes empty.
