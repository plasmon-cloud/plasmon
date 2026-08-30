import { describe, expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

describe("production OS API in headless composition", () => {
  test("creates, replaces, reads, stats, and lists user resources through filesystem policy", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const folder = await env.os.fs.createDirectory("/Desktop/OS API Folder");
      expect(folder.path).toBe("/Desktop/OS API Folder");
      expect(folder.kind).toBe("directory");

      const created = await env.os.fs.writeText(
        "/Desktop/OS API Folder/notes.txt",
        "first value",
      );
      expect(created.path).toBe("/Desktop/OS API Folder/notes.txt");
      expect(created.kind).toBe("file");
      expect(created.mimeType).toBe("text/plain");
      expect(await env.os.fs.exists(created.path)).toBe(true);
      expect(await env.os.fs.readText(created.path)).toBe("first value");

      const second = await env.os.fs.writeText(
        "/Desktop/OS API Folder/second.txt",
        "second value",
      );
      const listed = await env.os.fs.list(folder.path);
      expect(listed).toHaveLength(2);
      expect(new Set(listed.map((resource) => resource.id))).toEqual(
        new Set([created.id, second.id]),
      );
      expect(listed.every((resource) => resource.path.startsWith(`${folder.path}/`))).toBe(true);

      const replaced = await env.os.fs.writeText(created.path, "replacement");
      expect(replaced.id).toBe(created.id);
      expect(await env.os.fs.readText(created.path)).toBe("replacement");
      expect(await env.os.fs.stat(created.path)).toEqual(replaced);
    } finally {
      env.dispose();
    }
  });

  test("directory listing requires an absolute directory path", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const file = await env.os.fs.writeText("/Desktop/list-target.txt", "value");
      await expect(env.os.fs.list("Desktop")).rejects.toThrow("absolute path");
      await expect(env.os.fs.list(file.path)).rejects.toThrow("not a directory");
    } finally {
      env.dispose();
    }
  });

  test("copies resources through canonical filesystem semantics", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const source = await env.os.fs.writeText("/Desktop/copy-source.txt", "copy value");
      const copied = await env.os.fs.copy(source.path, "/Documents");

      expect(copied.id).not.toBe(source.id);
      expect(copied.path).toBe("/Documents/copy-source.txt");
      expect(await env.os.fs.readText(copied.path)).toBe("copy value");
      expect(await env.os.fs.exists(source.path)).toBe(true);
    } finally {
      env.dispose();
    }
  });

  test("moves resources while preserving stable identity", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const source = await env.os.fs.writeText("/Desktop/move-source.txt", "move value");
      const destination = await env.os.fs.createDirectory("/Desktop/Move Target");
      const moved = await env.os.fs.move(source.path, destination.path);

      expect(moved.id).toBe(source.id);
      expect(moved.path).toBe(`${destination.path}/move-source.txt`);
      expect(await env.os.fs.exists(source.path)).toBe(false);
      expect(await env.os.fs.readText(moved.path)).toBe("move value");
    } finally {
      env.dispose();
    }
  });

  test("removes resources through the canonical Recycle Bin authority", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const source = await env.os.fs.writeText("/Desktop/remove-source.txt", "remove value");
      await env.os.fs.remove(source.path);

      expect(await env.os.fs.exists(source.path)).toBe(false);

      // This is an adapter-contract assertion, not workflow setup: inspect the
      // owning production Trash authority to prove remove() delegated there.
      const trashEntries = await env.services.filesystem.trash.list();
      expect(trashEntries.some(
        (entry) => entry.node.id === source.id && entry.originalPath === source.path,
      )).toBe(true);
    } finally {
      env.dispose();
    }
  });

  test("filesystem mutations do not bypass protected product policy", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      await expect(
        env.os.fs.writeText("/System/forbidden.txt", "must not be created"),
      ).rejects.toThrow("system-managed");
      expect(await env.os.fs.exists("/System/forbidden.txt")).toBe(false);

      await expect(env.os.fs.move("/System/FileManager.sys", "/Documents")).rejects.toThrow(
        "protected",
      );
      await expect(env.os.fs.remove("/System/FileManager.sys")).rejects.toThrow("protected");
      expect(await env.os.fs.exists("/System/FileManager.sys")).toBe(true);
    } finally {
      env.dispose();
    }
  });

  test("opens a directly-targeted resource and reports native process/window outcomes", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const folder = await env.os.fs.createDirectory("/Desktop/Opened Through OS API");
      const opened = await env.os.open(folder.path);

      expect(opened.resource).toEqual(folder);
      expect(opened.handlerId).toBe("native:explorer");
      expect(opened.processId).toBeDefined();
      expect(opened.windowId).toBeDefined();

      const processes = env.os.processes.list();
      expect(processes).toHaveLength(1);
      expect(processes[0]).toMatchObject({
        id: opened.processId,
        appId: "native:explorer",
        handlerId: "native:explorer",
        state: "running",
        windowId: opened.windowId,
      });

      const windows = env.os.windows.list();
      expect(windows).toHaveLength(1);
      expect(windows[0]).toMatchObject({
        id: opened.windowId,
        processId: opened.processId,
        minimized: false,
        maximized: false,
      });
    } finally {
      env.dispose();
    }
  });

  test("does not guess process attribution for indirect shortcut opens", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const opened = await env.os.open("/Desktop/Root");

      expect(opened.resource.path).toBe("/Desktop/Root");
      expect(opened.handlerId).toBeUndefined();
      expect(opened.processId).toBeUndefined();
      expect(opened.windowId).toBeUndefined();

      const processes = env.os.processes.list();
      expect(processes).toHaveLength(1);
      expect(processes[0]).toMatchObject({
        appId: "native:explorer",
        handlerId: "native:explorer",
        state: "running",
      });
    } finally {
      env.dispose();
    }
  });
});
