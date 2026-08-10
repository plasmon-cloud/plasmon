import {
  exposeTool,
  publishAppStateChange,
  type JsonObject as NeutronJsonObject,
  type JsonValue as NeutronJsonValue,
} from "neutron-tools/app";
import { createBrowserFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import { FS_STATE_TOPIC, FsRpcServer, type JsonObject } from "./transport.ts";
import { FS_TOOL_DEFINITIONS } from "./toolDefinitions.ts";

const ready = (async () => {
  const repository = await createBrowserFsRepository({
    onFallback: (error) => console.warn("Plasmon filesystem storage fallback:", error.message),
  });
  const fs = new PersistentFsService(repository, {
    onCommit: (revision) => {
      if (revision <= BigInt(Number.MAX_SAFE_INTEGER)) {
        void publishAppStateChange(FS_STATE_TOPIC, Number(revision)).catch((error: unknown) => {
          console.warn("Plasmon filesystem invalidation publication failed:", error);
        });
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

for (const { name, title, description, annotations } of FS_TOOL_DEFINITIONS) {
  exposeTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations,
    },
    async (args) => {
      const server = await ready;
      return await server.call(name, args as JsonObject) as NeutronJsonValue;
    },
  );
}
