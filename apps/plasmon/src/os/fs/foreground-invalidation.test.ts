import { test } from "bun:test";
import assert from "node:assert/strict";
import { MemoryFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import { FS_STATE_TOPIC, FsRpcClient, FsRpcServer } from "./transport.ts";

const text = (value: string) => new TextEncoder().encode(value);

test("foreground RPC writes invalidate local subscribers and de-duplicate echoed state", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const desktop = await fs.resolvePath("/Desktop");
  if (!desktop) throw new Error("Desktop was not initialized");
  const file = await fs.createFile(desktop.id, "runtime-config.json");
  const server = new FsRpcServer(fs);
  let stateListener: (() => void) | undefined;
  const client = new FsRpcClient(
    (name, args) => server.call(name, args),
    (topic, listener) => {
      assert.equal(topic, FS_STATE_TOPIC);
      stateListener = listener;
      return () => { stateListener = undefined; };
    },
  );
  const resets: bigint[] = [];
  const unsubscribe = client.subscribe((event) => {
    if (event.type === "reset") resets.push(event.revision);
  });

  await client.write(file.id, text("updated"), { truncate: true });
  const revision = await fs.revision();
  assert.deepEqual(resets, [revision]);

  stateListener?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(resets, [revision]);

  await assert.rejects(() => client.write("missing-node", text("nope"), { truncate: true }), /unknown/i);
  assert.deepEqual(resets, [revision]);
  unsubscribe();
});
