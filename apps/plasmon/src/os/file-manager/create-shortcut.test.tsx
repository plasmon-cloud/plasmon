import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FsNode } from "../contracts/index.ts";
import { readSharedShortcut, resourceCapabilities } from "../fs/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import {
  canCreateFileManagerShortcut,
  createFileManagerShortcut,
  fileManagerShortcutTarget,
} from "./create-shortcut.ts";
import { FileManager } from "./FileManager.tsx";
import { FileOperationClipboard, renameNode } from "./model.ts";

async function requireDirectory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

test("FileManager Create Shortcut uses canonical NodeId metadata, collisions, selection, and normal rename", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const desktop = await requireDirectory(environment, "/Desktop");
    const target = await environment.services.fs.createFile(documents.id, "report.txt", {
      mime: "text/plain",
    });

    const first = await createFileManagerShortcut(environment.services.fs, documents.id, target);
    expect(first.shortcut.kind).toBe("shortcut");
    expect(first.shortcut.parentId).toBe(documents.id);
    expect(first.shortcut.name).toBe("report.txt (1)");
    expect(readSharedShortcut(first.shortcut)).toEqual({
      format: "plasmon.shortcut",
      version: 1,
      target: { kind: "node", nodeId: target.id },
    });
    expect([...first.selection.ids]).toEqual([first.shortcut.id]);
    expect(first.selection.anchor).toBe(first.shortcut.id);
    expect(first.selection.focus).toBe(first.shortcut.id);

    const second = await createFileManagerShortcut(environment.services.fs, documents.id, target);
    expect(second.shortcut.name).toBe("report.txt (2)");

    const renamedTarget = await environment.services.fs.rename(target.id, "renamed-report.txt");
    expect(renamedTarget.id).toBe(target.id);
    const movedTarget = await environment.services.fs.move(target.id, desktop.id);
    expect(movedTarget.id).toBe(target.id);
    expect(readSharedShortcut(await environment.services.fs.stat(first.shortcut.id))?.target).toEqual({
      kind: "node",
      nodeId: target.id,
    });

    const renamedShortcut = await renameNode(environment.services.fs, first.shortcut.id, "Report Shortcut");
    expect(renamedShortcut.id).toBe(first.shortcut.id);
    expect(renamedShortcut.name).toBe("Report Shortcut");
  } finally {
    environment.dispose();
  }
});

test("Create Shortcut eligibility requires one selection and follows canonical resource capabilities", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const ordinary = await environment.services.fs.createFile(documents.id, "ordinary.txt", {
      mime: "text/plain",
    });
    const photos = await environment.node("/System/Photos.sys");
    if (!photos) throw new Error("Photos.sys is unavailable");

    expect(resourceCapabilities(photos)).toMatchObject({
      delete: false,
      rename: false,
      createShortcut: true,
    });

    const nodes = [ordinary, photos];
    expect(canCreateFileManagerShortcut(nodes, new Set())).toBe(false);
    expect(canCreateFileManagerShortcut(nodes, new Set([ordinary.id, photos.id]))).toBe(false);
    expect(fileManagerShortcutTarget(nodes, new Set([ordinary.id]))?.id).toBe(ordinary.id);
    expect(fileManagerShortcutTarget(nodes, new Set([photos.id]))?.id).toBe(photos.id);

    const protectedTargetShortcut = await createFileManagerShortcut(
      environment.services.fs,
      documents.id,
      photos,
    );
    expect(readSharedShortcut(protectedTargetShortcut.shortcut)?.target).toEqual({
      kind: "node",
      nodeId: photos.id,
    });
  } finally {
    environment.dispose();
  }
});

test("FileManager exposes the bounded Create Shortcut command in its normal command surface", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const markup = renderToStaticMarkup(
      <FileManager
        directoryId={documents.id}
        fs={environment.services.fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
      />,
    );
    expect(markup).toContain("Create Shortcut");
  } finally {
    environment.dispose();
  }
});
