import {
  exposeTool,
  publishAppStateChange,
  type JsonObject as NeutronJsonObject,
  type JsonValue as NeutronJsonValue,
} from "neutron-tools/app";
import { createBrowserFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import { FS_STATE_TOPIC, FS_TOOLS, FsRpcServer, type FsToolName, type JsonObject } from "./transport.ts";

const ready = (async () => {
  const repository = await createBrowserFsRepository({
    onFallback: (error) => console.warn("Plasmon filesystem storage fallback:", error.message),
  });
  const fs = new PersistentFsService(repository, {
    onCommit: (revision) => {
      if (revision <= BigInt(Number.MAX_SAFE_INTEGER)) {
        publishAppStateChange(FS_STATE_TOPIC, Number(revision));
      } else {
        console.warn("Plasmon filesystem revision exceeds Neutron app-state integer range");
      }
    },
  });
  await fs.revision();
  return new FsRpcServer(fs);
})();

const inputSchema: NeutronJsonObject = {
  type: "object",
  additionalProperties: true,
};
const readAnnotations: NeutronJsonObject = { "neutron:effects": ["read"] };
const writeAnnotations: NeutronJsonObject = { "neutron:effects": ["write"] };

const definitions: Array<[FsToolName, string, string, boolean]> = [
  [FS_TOOLS.stat, "Filesystem Stat", "Read metadata for one Plasmon filesystem node.", false],
  [FS_TOOLS.resolvePath, "Resolve Filesystem Path", "Resolve an absolute Plasmon filesystem path.", false],
  [FS_TOOLS.pathOf, "Read Filesystem Path", "Read the current path for one stable filesystem node ID.", false],
  [FS_TOOLS.list, "List Filesystem Directory", "List child resources in one filesystem directory.", false],
  [FS_TOOLS.readChunk, "Read Filesystem Chunk", "Read one bounded byte range from a filesystem resource.", false],
  [FS_TOOLS.revision, "Read Filesystem Revision", "Read the current monotonic filesystem revision.", false],
  [FS_TOOLS.mkdir, "Create Filesystem Directory", "Create one directory in the Plasmon filesystem.", true],
  [FS_TOOLS.createFile, "Create Filesystem Resource", "Create one file, shortcut, or Atom resource.", true],
  [FS_TOOLS.rename, "Rename Filesystem Resource", "Rename a filesystem resource without changing its identity.", true],
  [FS_TOOLS.move, "Move Filesystem Resource", "Move a filesystem resource without changing its identity.", true],
  [FS_TOOLS.copy, "Copy Filesystem Resource", "Copy a filesystem resource with a new stable identity.", true],
  [FS_TOOLS.remove, "Remove Filesystem Resource", "Permanently remove a filesystem resource.", true],
  [FS_TOOLS.metadataPatch, "Update Filesystem Metadata", "Patch filesystem metadata/xattrs.", true],
  [FS_TOOLS.writeBegin, "Begin Filesystem Write", "Begin a bounded chunked filesystem upload.", true],
  [FS_TOOLS.writeChunk, "Write Filesystem Chunk", "Append one bounded transport chunk to an upload.", true],
  [FS_TOOLS.writeCommit, "Commit Filesystem Write", "Atomically commit a completed chunked upload.", true],
  [FS_TOOLS.writeAbort, "Abort Filesystem Write", "Discard an incomplete chunked filesystem upload.", true],
];

for (const [name, title, description, write] of definitions) {
  exposeTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: write ? writeAnnotations : readAnnotations,
    },
    async (args) => {
      const server = await ready;
      return await server.call(name, args as JsonObject) as NeutronJsonValue;
    },
  );
}
