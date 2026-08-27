import { expect, test } from "bun:test";
import type { FsNode } from "../src/os/contracts/index.ts";
import { readSharedShortcut } from "../src/os/fs/index.ts";
import {
  activateFileManagerNode,
  createFileManagerShortcut,
  sendFileManagerShortcutToDesktop,
} from "../src/os/file-manager/index.ts";
import {
  activateSearchFilesystemResult,
  searchShell,
} from "../src/os/shell/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

async function requireDirectory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

function closeProcesses(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>): void {
  for (const process of environment.processes()) environment.services.process.close(process.id);
}

test("shortcut lifecycle keeps canonical identity across FileManager creation, Send to Desktop, and Shell activation", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const archive = await environment.services.fs.mkdir(documents.id, "Shortcut Archive");
    const target = await environment.services.fs.createFile(documents.id, "Lifecycle Target.txt", {
      mime: "text/plain",
    });

    const first = await createFileManagerShortcut(environment.services.fs, documents.id, target);
    const second = await createFileManagerShortcut(environment.services.fs, documents.id, target);
    expect(first.shortcut.name).toBe("Lifecycle Target.txt (1)");
    expect(second.shortcut.name).toBe("Lifecycle Target.txt (2)");

    const desktopShortcut = await sendFileManagerShortcutToDesktop(environment.services.fs, target);
    const desktopCollision = await sendFileManagerShortcutToDesktop(environment.services.fs, target);
    expect(desktopShortcut.name).toBe("Lifecycle Target.txt");
    expect(desktopCollision.name).toBe("Lifecycle Target.txt (1)");

    for (const shortcut of [first.shortcut, second.shortcut, desktopShortcut, desktopCollision]) {
      expect(readSharedShortcut(shortcut)?.target).toEqual({
        kind: "node",
        nodeId: target.id,
      });
    }

    const renamed = await environment.services.fs.rename(target.id, "Lifecycle Renamed.txt");
    expect(renamed.id).toBe(target.id);
    const moved = await environment.services.fs.move(target.id, archive.id);
    expect(moved.id).toBe(target.id);
    expect(await environment.services.fs.pathOf(target.id))
      .toBe("/Documents/Shortcut Archive/Lifecycle Renamed.txt");

    await activateFileManagerNode(environment.services.filesystem.open, first.shortcut);
    expect(environment.processes()).toHaveLength(1);
    expect(environment.processes()[0]).toMatchObject({
      handlerId: "native:text",
      target: expect.objectContaining({ nodeId: target.id }),
    });
    closeProcesses(environment);

    const search = await searchShell(
      environment.services.fs,
      environment.services.nativeApps.list(),
      [],
      "Lifecycle Target",
    );
    const shellResult = search.results.find(
      (result) => "node" in result && result.node.id === desktopShortcut.id,
    );
    if (!shellResult || !("node" in shellResult)) {
      throw new Error("Shell Search did not project the Desktop shortcut");
    }

    await activateSearchFilesystemResult(environment.services.filesystem.open, shellResult);
    expect(environment.processes()).toHaveLength(1);
    expect(environment.processes()[0]).toMatchObject({
      handlerId: "native:text",
      target: expect.objectContaining({ nodeId: target.id }),
    });
    closeProcesses(environment);

    await environment.services.fs.remove(target.id);

    await expect(
      activateFileManagerNode(environment.services.filesystem.open, first.shortcut),
    ).rejects.toThrow();
    expect(environment.processes()).toHaveLength(0);

    await expect(
      activateSearchFilesystemResult(environment.services.filesystem.open, shellResult),
    ).rejects.toThrow();
    expect(environment.processes()).toHaveLength(0);
  } finally {
    environment.dispose();
  }
});
