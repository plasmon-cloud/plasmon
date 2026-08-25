import { expect, test } from "bun:test";
import type { FsNode, NodeId } from "./contracts/index.ts";
import {
  executeOpenResourceCommand,
  openResourceCommand,
  runOpenResourceCommand,
  type ResourceOpenCommandAuthority,
} from "./resource-command.ts";

function node(id: NodeId): Pick<FsNode, "id"> {
  return { id };
}

test("#115 Open command preserves stable identity and caller-owned directory presentation", async () => {
  const calls: Array<{ nodeId: NodeId; hasDirectoryHandler: boolean }> = [];
  const onOpenDirectory = async () => {};
  const authority: ResourceOpenCommandAuthority = {
    async openNode(nodeId, options) {
      calls.push({ nodeId, hasDirectoryHandler: options?.onOpenDirectory === onOpenDirectory });
    },
  };

  const command = openResourceCommand(node("resource-command-open"), { onOpenDirectory });
  expect(command).toMatchObject({ kind: "open", nodeId: "resource-command-open" });

  const result = await runOpenResourceCommand(authority, command);
  expect(result).toEqual({ ok: true });
  expect(calls).toEqual([
    { nodeId: "resource-command-open", hasDirectoryHandler: true },
  ]);
});

test("#115 Open command reports canonical authority failure without replacing it", async () => {
  const failure = new Error("canonical opener rejected resource");
  const authority: ResourceOpenCommandAuthority = {
    async openNode() {
      throw failure;
    },
  };
  const command = openResourceCommand(node("resource-command-failure"));

  const result = await runOpenResourceCommand(authority, command);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(failure);

  await expect(executeOpenResourceCommand(authority, command)).rejects.toBe(failure);
});
