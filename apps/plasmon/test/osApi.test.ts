import { describe, expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

describe("production OsApi in headless composition", () => {
  test("creates, replaces, reads, stats, and lists user resources through filesystem policy", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const folder = await env.os.fs.createDirectory("/Desktop/OsApi Folder");
      expect(folder.path).toBe("/Desktop/OsApi Folder");
      expect(folder.kind).toBe("directory");

      const created = await env.os.fs.writeText(
        "/Desktop/OsApi Folder/notes.txt",
        "first value",
      );
      expect(created.path).toBe("/Desktop/OsApi Folder/notes.txt");
      expect(created.kind).toBe("file");
      expect(created.mimeType).toBe("text/plain");
      expect(await env.os.fs.exists(created.path)).toBe(true);
      expect(await env.os.fs.readText(created.path)).toBe("first value");

      const second = await env.os.fs.writeText(
        "/Desktop/OsApi Folder/second.txt",
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

  test("opens a resource through canonical dispatch and reports native process/window outcomes", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      const folder = await env.os.fs.createDirectory("/Desktop/Opened Through OsApi");
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

  test("does not bypass protected filesystem policy", async () => {
    const env = createHeadlessPlasmonEnvironment();

    try {
      await env.ready;
      await expect(
        env.os.fs.writeText("/System/forbidden.txt", "must not be created"),
      ).rejects.toThrow("system-managed");
      expect(await env.os.fs.exists("/System/forbidden.txt")).toBe(false);
    } finally {
      env.dispose();
    }
  });
});
