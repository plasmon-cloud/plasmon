# Issue #51 — Send to Desktop shortcut command

## Disposition

**RTL RED.** The production FileManager renders no `Send to Desktop` command for
an eligible selected resource. The gate uses the canonical headless filesystem,
real FileManager React adapter, and user-event selection/click vocabulary; it
will also verify the resulting Desktop node stores the target NodeId.

Run:

```sh
bun test --preload ./apps/plasmon/test/setupHappyDom.ts ./apps/plasmon/test/tdd/.red/issue-51.red.ui.test.tsx
```

## PRESERVE

- `createShortcut()` and `shortcutMetadata()` remain the only shortcut format
  and serializer.
- Filesystem owns target identity, collision naming, and resource protection.
- FileManager owns selection and command presentation only.
- The original resource remains in its original location and NodeId.

## CHANGE

- Expose a bounded Send to Desktop action for one eligible selected resource.
- Resolve `/Desktop` through FsService and delegate creation to the canonical
  shortcut primitive.
- Surface deterministic unavailable-target/Desktop errors.

## UNSPECIFIED

- Toolbar versus context-menu placement, exact label punctuation, and helper
  names.
- Whether the action is grouped under a `Send to` submenu.

## Existing guards

`create-shortcut.test.tsx`, `desktopCore.test.ts`, activation/open tests, and
resource policy tests already protect canonical shortcut serialization,
collision naming, stable NodeId dereference, and protected resources. This gate
only adds the missing Desktop-destination consumer journey.
