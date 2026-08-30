import { callTool, onAppStateChange, type JsonValue as NeutronJsonValue } from "neutron-tools/app";
import { admitFrontendToolCall } from "../neutron/frontend-call-admission.ts";
import { FS_BACKGROUND_TARGET, FsRpcClient, type FsToolName, type JsonObject } from "./transport.ts";

/** Production foreground client bound to Plasmon's persistent background endpoint. */
export function createNeutronFsClient(): FsRpcClient {
  return new FsRpcClient(
    (name: FsToolName, arguments_: JsonObject) => admitFrontendToolCall(
      name,
      () => callTool<NeutronJsonValue>({
        target: FS_BACKGROUND_TARGET,
        name,
        arguments: arguments_,
      }) as Promise<import("../contracts/common.ts").JsonValue>,
    ),
    (topic, listener) => onAppStateChange(topic, () => listener()),
  );
}
