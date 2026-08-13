# #64 save identity contract

Preserve stable source game `NodeId` as the primary association. A basename or
path is presentation only and cannot identify progress across rename/move.
Copies receive a new NodeId and must not inherit progress unless an explicit
copy policy says so. Trash move/restore preserves NodeId; permanent deletion
removes or tombstones the associated progress according to accepted FS policy.

A save record must retain source NodeId, runtime id/version, format/schema
version, payload identity/length/integrity, created/updated timestamps, and an
explicit compatibility decision. It must be reachable through FsService and
must not become browser IndexedDB/OPFS authority. The exact visible/hidden path
and record shape remain UNSPECIFIED pending the runtime API and #64 owner.
