import { expect, test } from "bun:test";
import type { FsNode } from "../../os/contracts/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { ExplorerNavigationModel } from "./navigation.ts";

async function requireDirectory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

async function location(fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"], node: FsNode) {
  return { nodeId: node.id, path: await fs.pathOf(node.id) };
}

test("Explorer navigation walks A -> B -> C backward and forward without duplicate no-op entries", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const documents = await requireDirectory(environment, "/Documents");
    const a = await fs.mkdir(documents.id, "History A");
    const b = await fs.mkdir(documents.id, "History B");
    const c = await fs.mkdir(documents.id, "History C");
    const navigation = new ExplorerNavigationModel(fs, await location(fs, a));

    await navigation.navigateNode(b.id);
    await navigation.navigateNode(c.id);
    expect(navigation.snapshot().entries.map((entry) => entry.nodeId)).toEqual([a.id, b.id, c.id]);

    expect((await navigation.back())?.nodeId).toBe(b.id);
    expect((await navigation.back())?.nodeId).toBe(a.id);
    expect((await navigation.forward())?.nodeId).toBe(b.id);
    expect((await navigation.forward())?.nodeId).toBe(c.id);

    const beforeNoOp = navigation.snapshot();
    await navigation.navigateNode(c.id);
    await navigation.navigatePath(await fs.pathOf(c.id));
    const afterNoOp = navigation.snapshot();
    expect(afterNoOp.entries.map((entry) => entry.nodeId)).toEqual(beforeNoOp.entries.map((entry) => entry.nodeId));
    expect(afterNoOp.index).toBe(beforeNoOp.index);
  } finally {
    environment.dispose();
  }
});

test("Explorer Up, direct address navigation, and folder activation share one history model", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const documents = await requireDirectory(environment, "/Documents");
    const a = await fs.mkdir(documents.id, "Route A");
    const b = await fs.mkdir(a.id, "Route B");
    const c = await fs.mkdir(b.id, "Route C");
    const navigation = new ExplorerNavigationModel(fs, await location(fs, a));

    await navigation.navigatePath(await fs.pathOf(b.id));
    await navigation.navigateNode(c.id);
    expect(navigation.snapshot().entries.map((entry) => entry.nodeId)).toEqual([a.id, b.id, c.id]);

    expect((await navigation.up())?.nodeId).toBe(b.id);
    expect(navigation.snapshot().entries.map((entry) => entry.nodeId)).toEqual([a.id, b.id, c.id, b.id]);

    // Up is a new navigation, not a history rewind: Back returns to C.
    expect((await navigation.back())?.nodeId).toBe(c.id);
    expect((await navigation.forward())?.nodeId).toBe(b.id);
  } finally {
    environment.dispose();
  }
});

test("Explorer history resolves stable NodeIds and prunes deleted historical targets safely", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const documents = await requireDirectory(environment, "/Documents");
    const container = await fs.mkdir(documents.id, "Moved Container");
    const a = await fs.mkdir(documents.id, "Stable A");
    const b = await fs.mkdir(documents.id, "Stable B");
    const c = await fs.mkdir(documents.id, "Stable C");
    const navigation = new ExplorerNavigationModel(fs, await location(fs, a));

    await navigation.navigateNode(b.id);
    await navigation.navigateNode(c.id);
    await fs.rename(b.id, "Renamed B");
    await fs.move(b.id, container.id);

    const renamedBack = await navigation.back();
    expect(renamedBack?.nodeId).toBe(b.id);
    expect(renamedBack?.path).toBe("/Documents/Moved Container/Renamed B");

    await navigation.forward();
    await fs.remove(b.id, { recursive: true });

    // The now-unreachable B entry is discarded and Back continues to the
    // previous valid location without corrupting the current/forward cursor.
    const safeBack = await navigation.back();
    expect(safeBack?.nodeId).toBe(a.id);
    expect(navigation.snapshot().entries.map((entry) => entry.nodeId)).toEqual([a.id, c.id]);
    expect(navigation.snapshot().index).toBe(0);
    expect((await navigation.forward())?.nodeId).toBe(c.id);
  } finally {
    environment.dispose();
  }
});
