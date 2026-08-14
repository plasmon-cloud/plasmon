import { expect, test } from "bun:test";
import type { FsNode } from "../../../src/os/contracts/index.ts";
import { activateFileManagerNode } from "../../../src/os/file-manager/index.ts";
import {
  createFileManagerShortcut,
  sendFileManagerShortcutToDesktop,
} from "../../../src/os/file-manager/create-shortcut.ts";
import { createShortcut } from "../../../src/os/fs/index.ts";
import {
  activateSearchFilesystemResult,
  activateStartFilesystemNode,
  searchFilesystem,
} from "../../../src/os/shell/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

function directory(node: FsNode | null, path: string): FsNode {
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

async function searchNode(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>, node: FsNode) {
  const batch = await searchFilesystem(environment.services.fs, node.name);
  const result = batch.results.find((candidate) => "node" in candidate && candidate.node.id === node.id);
  if (!result || !("node" in result)) throw new Error(`Search did not expose ${node.name}`);
  return result;
}

test("#78 lifecycle — Create Shortcut and Send to Desktop retain target NodeId across rename/move and surfaces", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = directory(await environment.node("/Documents"), "/Documents");
    const desktop = directory(await environment.node("/Desktop"), "/Desktop");
    const start = directory(await environment.node("/System/Start Menu"), "/System/Start Menu");
    const target = await environment.services.fs.createFile(documents.id, "lifecycle-target.txt", { mime: "text/plain" });
    const shortcut = (await createFileManagerShortcut(environment.services.fs, documents.id, target)).shortcut;
    const desktopShortcut = await sendFileManagerShortcutToDesktop(environment.services.fs, target);
    expect(desktopShortcut.parentId).toBe(desktop.id);

    await environment.services.fs.rename(target.id, "lifecycle-renamed.txt");
    await environment.services.fs.move(target.id, desktop.id);
    const startShortcut = await createShortcut(
      environment.services.fs,
      start.id,
      { kind: "node", nodeId: target.id },
      { name: "Lifecycle Start Shortcut" },
    );

    for (const node of [shortcut, desktopShortcut, startShortcut]) {
      expect((await environment.services.fs.stat(node.id)).metadata["plasmon.shortcut"]).toMatchObject({
        target: { kind: "node", nodeId: target.id },
      });
    }

    await activateFileManagerNode(environment.services.filesystem.open, shortcut);
    expect(environment.processes().at(-1)?.target.nodeId).toBe(target.id);
    if (environment.processes()[0]) environment.services.process.close(environment.processes()[0]!.id);

    await activateStartFilesystemNode(environment.services.filesystem.open, startShortcut);
    expect(environment.processes().at(-1)?.target.nodeId).toBe(target.id);
    if (environment.processes()[0]) environment.services.process.close(environment.processes()[0]!.id);

    await activateSearchFilesystemResult(environment.services.filesystem.open, await searchNode(environment, startShortcut));
    expect(environment.processes().at(-1)?.target.nodeId).toBe(target.id);
    if (environment.processes()[0]) environment.services.process.close(environment.processes()[0]!.id);

    await environment.services.fs.remove(target.id);
    await expect(environment.services.filesystem.open.openNode(shortcut.id)).rejects.toThrow();
  } finally {
    environment.dispose();
  }
});
