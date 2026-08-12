# Recycle Bin design

Plasmon's Recycle Bin is implemented by the canonical filesystem core. FileManager consumes that authority for ordinary Delete; it does not implement a second Trash model or call raw permanent removal for normal user deletion.

## Canonical model

- Canonical location: `/System/.Trash`.
- Trash is ordinary filesystem state managed by filesystem/core policy rather than a new `FsNode` kind or parallel repository.
- `FilesystemCoreServices.trash` is the public service seam used by UI consumers.
- `TrashService.trash(nodeId)` checks canonical resource capabilities before mutation.
- A soft delete moves the existing node, preserving its stable NodeId and directory descendants.
- Each deletion gets a hidden wrapper directory under `/System/.Trash`. The wrapper carries versioned `plasmon.trash` metadata with:
  - trashed node ID;
  - original parent NodeId;
  - original name;
  - original path for presentation/history;
  - deletion timestamp.
- The trashed resource itself is moved inside that wrapper; FileManager does not write or interpret this metadata.

## Ordinary FileManager Delete

FileManager's ordinary Delete command delegates selected resources to the canonical Trash authority. Confirmation, selection reconciliation, and visible errors remain presentation responsibilities.

For a multi-selection, the FileManager adapter attempts nodes in stable input order and records successes and failures independently. This permits deletable resources to reach Trash even when another selected resource is protected. Failed resources remain in their source folder after refresh and canonical policy errors remain visible.

Permanent removal is not the ordinary FileManager Delete path.

## Protection semantics

Filesystem resource policy remains authoritative:

- protected/system resources cannot be trashed through ordinary Delete;
- installed Neutron application projections are rejected with the canonical instruction to use Uninstall instead;
- resources already inside Recycle Bin are rejected rather than recursively trashed;
- the filesystem root cannot be deleted.

FileManager must not infer or duplicate these restrictions.

## Restore

Restore finds the Trash entry by the stable trashed NodeId.

- The original parent NodeId is preferred over reconstructing a historical path.
- If the original parent is unavailable, the current canonical fallback is `/Desktop`.
- If the restored name collides, filesystem naming policy chooses a deterministic unique name.
- Directory restore moves the existing directory node and therefore preserves descendant NodeIds.
- The wrapper and Trash metadata are removed after successful restore.

## Permanent delete and Empty Recycle Bin

Permanent deletion and emptying are explicit Trash-service operations. They remain separate from ordinary FileManager Delete and are intended for Recycle Bin functionality. Filesystem policy continues to protect system/native and Neutron application resources from inappropriate permanent deletion.

## Architecture boundary

`FsService` remains the storage/mutation contract, while filesystem/core owns managed-resource policy and Trash semantics around it. UI layers receive the public Trash service through composition. This keeps one filesystem authority, one identity model, and one persistence boundary while allowing Desktop and Explorer to share the same Delete behavior.
