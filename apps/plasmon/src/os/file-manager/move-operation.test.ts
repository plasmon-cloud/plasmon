import { expect, test } from "bun:test";
import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { moveNodesToDirectory } from "./model.ts";

async function directory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

function failMoveFor(fs: FsService, failedId: NodeId): FsService {
  return new Proxy(fs, {
    get(target, property) {
      if (property === "move") {
        return async (nodeId: NodeId, destinationId: NodeId) => {
          if (nodeId === failedId) throw new Error("expected second move failure");
          return target.move(nodeId, destinationId);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("canonical directory move reports ordered partial mutation truth", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const documents = await directory(environment, "/Documents");
    const target = await fs.mkdir(documents.id, "Move Target");
    const first = await fs.createFile(documents.id, "one.txt", { mime: "text/plain" });
    const second = await fs.createFile(documents.id, "two.txt", { mime: "text/plain" });
    const events: string[] = [];

    await expect(moveNodesToDirectory(failMoveFor(fs, second.id), [first, second], target, {
      onItemStart: (index, node) => events.push(`start:${index}:${node.name}`),
      onItemSuccess: (index, node) => events.push(`success:${index}:${node.name}`),
      onItemFailure: (index, node, cause) => events.push(
        `failure:${index}:${node.name}:${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    })).rejects.toThrow("expected second move failure");

    expect(events).toEqual([
      "start:1:one.txt",
      "success:1:one.txt",
      "start:2:two.txt",
      "failure:2:two.txt:expected second move failure",
    ]);
    expect((await fs.stat(first.id)).parentId).toBe(target.id);
    expect((await fs.stat(second.id)).parentId).toBe(documents.id);
  } finally {
    environment.dispose();
  }
});
