import { expect, test } from "bun:test";
import type { FsNode, FsService } from "../contracts/index.ts";
import { readSharedShortcut } from "../fs/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { sendFileManagerShortcutToDesktop } from "./create-shortcut.ts";

async function requireDirectory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

test("Send to Desktop creates a canonical NodeId shortcut without moving or copying the source", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const desktop = await requireDirectory(environment, "/Desktop");
    const source = await environment.services.fs.createFile(documents.id, "report.txt", { mime: "text/plain" });

    const shortcut = await sendFileManagerShortcutToDesktop(environment.services.fs, source);
    expect(shortcut.parentId).toBe(desktop.id);
    expect(readSharedShortcut(shortcut)?.target).toEqual({ kind: "node", nodeId: source.id });

    const currentSource = await environment.services.fs.stat(source.id);
    expect(currentSource).toMatchObject({ id: source.id, parentId: documents.id, name: "report.txt" });
  } finally {
    environment.dispose();
  }
});

test("Send to Desktop delegates collision naming to the canonical shortcut primitive", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const desktop = await requireDirectory(environment, "/Desktop");
    const source = await environment.services.fs.createFile(documents.id, "report.txt", { mime: "text/plain" });
    await environment.services.fs.createFile(desktop.id, "report.txt");

    const first = await sendFileManagerShortcutToDesktop(environment.services.fs, source);
    const second = await sendFileManagerShortcutToDesktop(environment.services.fs, source);
    expect(first.name).toBe("report.txt (1)");
    expect(second.name).toBe("report.txt (2)");
  } finally {
    environment.dispose();
  }
});

test("Send to Desktop can target a protected canonical system application without mutating it", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const photos = await environment.node("/System/Photos.sys");
    if (!photos) throw new Error("Photos.sys is unavailable");
    const shortcut = await sendFileManagerShortcutToDesktop(environment.services.fs, photos);
    expect(readSharedShortcut(shortcut)?.target).toEqual({ kind: "node", nodeId: photos.id });
    expect(await environment.services.fs.stat(photos.id)).toMatchObject({ id: photos.id, parentId: photos.parentId });
  } finally {
    environment.dispose();
  }
});

test("Send to Desktop reports unavailable Desktop and stale target deterministically", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await requireDirectory(environment, "/Documents");
    const source = await environment.services.fs.createFile(documents.id, "gone.txt", { mime: "text/plain" });
    const withoutDesktop = new Proxy(environment.services.fs, {
      get(target, property, receiver) {
        if (property !== "resolvePath") return Reflect.get(target, property, receiver);
        return async (path: string) => path === "/Desktop" ? null : target.resolvePath(path);
      },
    }) as FsService;
    await expect(sendFileManagerShortcutToDesktop(withoutDesktop, source)).rejects.toThrow("Desktop is unavailable");

    await environment.services.fs.remove(source.id);
    await expect(sendFileManagerShortcutToDesktop(environment.services.fs, source)).rejects.toThrow("gone.txt is no longer available");
  } finally {
    environment.dispose();
  }
});
