import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

test("#182 fresh bootstrap excludes managed Downloads and remains idempotent", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const root = await environment.node("/");
    if (!root) throw new Error("root bootstrap missing");
    const first = await environment.services.fs.list(root.id, { includeHidden: false, sort: "name" });
    expect(first.some((node) => node.kind === "directory" && node.name === "Downloads")).toBe(false);
    const snapshot = first.map((node) => `${node.id}:${node.name}:${node.kind}`).sort();
    const repository = environment.repository;
    environment.dispose();
    const recomposed = createHeadlessPlasmonEnvironment({ repository });
    try {
      await recomposed.ready;
      const recomposedRoot = await recomposed.node("/");
      if (!recomposedRoot) throw new Error("recomposed root missing");
      const second = await recomposed.services.fs.list(recomposedRoot.id, { includeHidden: false, sort: "name" });
      expect(second.map((node) => `${node.id}:${node.name}:${node.kind}`).sort()).toEqual(snapshot);
    } finally {
      recomposed.dispose();
    }
  } finally {
    environment.dispose();
  }
});

test("#182 user root directories and intentional deletion survive recomposition", async () => {
  const first = createHeadlessPlasmonEnvironment();
  try {
    await first.ready;
    const root = await first.node("/");
    if (!root) throw new Error("root bootstrap missing");
    const custom = await first.services.fs.mkdir(root.id, "My Projects");
    const renamed = await first.services.fs.rename(custom.id, "Renamed Projects");
    expect(renamed.id).toBe(custom.id);
    await first.services.fs.remove(renamed.id);
    const repository = first.repository;
    first.dispose();

    const second = createHeadlessPlasmonEnvironment({ repository });
    try {
      await second.ready;
      expect(await second.node("/My Projects")).toBeNull();
      expect(await second.node("/Renamed Projects")).toBeNull();
      const rootAfter = await second.node("/");
      if (!rootAfter) throw new Error("recomposed root missing");
      const names = (await second.services.fs.list(rootAfter.id, { includeHidden: false })).map((node) => node.name);
      expect(names).not.toContain("Downloads");
    } finally {
      second.dispose();
    }
  } catch (error) {
    first.dispose();
    throw error;
  }
});
