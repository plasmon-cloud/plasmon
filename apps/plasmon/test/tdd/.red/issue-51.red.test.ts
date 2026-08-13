import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { createFileManagerShortcut } from "../../../src/os/file-manager/create-shortcut.ts";
import { readSharedShortcut, type FsNode } from "../../../src/os/fs/index.ts";

async function directory(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>, path: string): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("#51 canonical shortcut consumer preserves target identity, source placement, and collisions", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const desktop = await directory(environment, "/Desktop");
    const target = await environment.services.fs.createFile(documents.id, "Send Me.txt", { mime: "text/plain" });
    const before = await environment.services.fs.stat(target.id);
    const first = await createFileManagerShortcut(environment.services.fs, desktop.id, target);
    const second = await createFileManagerShortcut(environment.services.fs, desktop.id, target);
    expect(first.shortcut.id).not.toBe(second.shortcut.id);
    expect(second.shortcut.name).toBe("Send Me.txt (1)");
    expect(readSharedShortcut(first.shortcut)?.target).toEqual({ kind: "node", nodeId: target.id });
    expect(readSharedShortcut(second.shortcut)?.target).toEqual({ kind: "node", nodeId: target.id });
    expect(await environment.services.fs.stat(target.id)).toEqual(before);
    expect((await environment.services.fs.list(documents.id)).some((node) => node.id === target.id)).toBe(true);
    const renamed = await environment.services.fs.rename(first.shortcut.id, "Send Me Shortcut");
    expect(renamed.id).toBe(first.shortcut.id);
    expect(readSharedShortcut(renamed)?.target).toEqual({ kind: "node", nodeId: target.id });
  } finally {
    environment.dispose();
  }
});

test("#51 canonical consumer fails without a target or destination instead of creating partial state", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const desktop = await directory(environment, "/Desktop");
    const target = await environment.services.fs.createFile(documents.id, "Target.txt", { mime: "text/plain" });
    await expect(createFileManagerShortcut(environment.services.fs, desktop.id, { ...target, id: "missing-target" })).rejects.toThrow();
    await expect(createFileManagerShortcut(environment.services.fs, "missing-desktop", target)).rejects.toThrow();
    const shortcuts = (await environment.services.fs.list(desktop.id)).filter((node) => node.kind === "shortcut");
    expect(shortcuts.some((node) => node.metadata["plasmon.shortcut"] && JSON.stringify(node.metadata["plasmon.shortcut"]).includes(target.id))).toBe(false);
  } finally {
    environment.dispose();
  }
});
