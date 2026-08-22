import { callTool, onAppStateChange, type JsonValue as NeutronJsonValue } from "neutron-tools/app";
import { withFsToolCallAdmission } from "./tool-call-admission.ts";
import { FS_BACKGROUND_TARGET, FsRpcClient, type FsToolName, type JsonObject } from "./transport.ts";

/** Production foreground client bound to Plasmon's persistent background endpoint. */
export function createNeutronFsClient(): FsRpcClient {
  const admittedCallTool = withFsToolCallAdmission(
    (name: FsToolName, arguments_: JsonObject) => callTool<NeutronJsonValue>({
      target: FS_BACKGROUND_TARGET,
      name,
      arguments: arguments_,
    }) as Promise<import("../contracts/common.ts").JsonValue>,
  );

  return new FsRpcClient(
    admittedCallTool,
    (topic, listener) => onAppStateChange(topic, () => listener()),
  );
}
