import {
  NEUTRON_TOOL_VISIBILITY_SAME_APP,
  type JsonObject as NeutronJsonObject,
  type NeutronToolVisibility,
} from "neutron-tools/app";
import { FS_TOOLS, type FsToolName } from "./transport.ts";

export interface FsToolDefinition {
  name: FsToolName;
  title: string;
  description: string;
  write: boolean;
  annotations: NeutronJsonObject;
}

const sameAppVisibility: NeutronToolVisibility = NEUTRON_TOOL_VISIBILITY_SAME_APP;

function annotations(write: boolean): NeutronJsonObject {
  return {
    "neutron:effects": [write ? "write" : "read"],
    "neutron:visibility": sameAppVisibility,
  };
}

function definition(
  name: FsToolName,
  title: string,
  description: string,
  write: boolean,
): FsToolDefinition {
  return { name, title, description, write, annotations: annotations(write) };
}

export const FS_TOOL_DEFINITIONS: readonly FsToolDefinition[] = [
  definition(FS_TOOLS.stat, "Filesystem Stat", "Read metadata for one Plasmon filesystem node.", false),
  definition(FS_TOOLS.resolvePath, "Resolve Filesystem Path", "Resolve an absolute Plasmon filesystem path.", false),
  definition(FS_TOOLS.pathOf, "Read Filesystem Path", "Read the current path for one stable filesystem node ID.", false),
  definition(FS_TOOLS.list, "List Filesystem Directory", "List child resources in one filesystem directory.", false),
  definition(FS_TOOLS.readChunk, "Read Filesystem Chunk", "Read one bounded byte range from a filesystem resource.", false),
  definition(FS_TOOLS.revision, "Read Filesystem Revision", "Read the current monotonic filesystem revision.", false),
  definition(FS_TOOLS.mkdir, "Create Filesystem Directory", "Create one directory in the Plasmon filesystem.", true),
  definition(FS_TOOLS.createFile, "Create Filesystem Resource", "Create one file, shortcut, or Atom resource.", true),
  definition(FS_TOOLS.rename, "Rename Filesystem Resource", "Rename a filesystem resource without changing its identity.", true),
  definition(FS_TOOLS.move, "Move Filesystem Resource", "Move a filesystem resource without changing its identity.", true),
  definition(FS_TOOLS.copy, "Copy Filesystem Resource", "Copy a filesystem resource with a new stable identity.", true),
  definition(FS_TOOLS.remove, "Remove Filesystem Resource", "Permanently remove a filesystem resource.", true),
  definition(FS_TOOLS.metadataPatch, "Update Filesystem Metadata", "Patch filesystem metadata/xattrs.", true),
  definition(FS_TOOLS.writeBegin, "Begin Filesystem Write", "Begin a bounded chunked filesystem upload.", true),
  definition(FS_TOOLS.writeChunk, "Write Filesystem Chunk", "Append one bounded transport chunk to an upload.", true),
  definition(FS_TOOLS.writeCommit, "Commit Filesystem Write", "Atomically commit a completed chunked upload.", true),
  definition(FS_TOOLS.writeAbort, "Abort Filesystem Write", "Discard an incomplete chunked filesystem upload.", true),
];
