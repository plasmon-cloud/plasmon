import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function closeProcesses(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>): void {
  for (const process of environment.services.process.list()) environment.services.process.close(process.id);
}

test("OsApi opens real system application launchers without passing the .sys resource as content", async () => {
  const environment = createHeadlessPlasmonEnvironment();

  try {
    await environment.ready;

    for (const [path, handlerId] of [
      ["/System/Browser.sys", "native:browser"],
      ["/System/Photos.sys", "native:photos"],
      ["/System/Video.sys", "native:video"],
      ["/System/Settings.sys", "native:settings"],
    ] as const) {
      expect(await environment.os.fs.exists(path)).toBe(true);
      const result = await environment.os.open(path);

      // OpenResult reports a process only when that process directly targets the
      // requested filesystem resource. A .sys launcher must therefore omit it
      // while still creating the canonical application process/window.
      expect(result.processId).toBeUndefined();
      expect(result.windowId).toBeUndefined();

      const processes = environment.os.processes.list();
      expect(processes).toHaveLength(1);
      expect(processes[0]?.handlerId).toBe(handlerId);
      expect(processes[0]?.state).toBe("running");
      expect(processes[0]?.windowId).toBeDefined();
      expect(environment.os.windows.list().some(
        (window) => window.processId === processes[0]?.id,
      )).toBe(true);

      closeProcesses(environment);
    }
  } finally {
    environment.dispose();
  }
});

test("OsApi keeps real Browser, Photos, and Video content activation distinct from launcher activation", async () => {
  const environment = createHeadlessPlasmonEnvironment();

  try {
    await environment.ready;
    const documents = await environment.services.fs.resolvePath("/Documents");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

    const shortcut = await environment.services.fs.createFile(documents.id, "sprint5.url", {
      mime: "application/x-mswinurl",
    });
    await environment.services.fs.write(
      shortcut.id,
      new TextEncoder().encode("[InternetShortcut]\nURL=https://example.com/sprint5\n"),
      { truncate: true },
    );
    await environment.services.fs.createFile(documents.id, "sprint5.png", { mime: "image/png" });
    await environment.services.fs.createFile(documents.id, "sprint5.mp4", { mime: "video/mp4" });

    for (const [path, handlerId] of [
      ["/Documents/sprint5.url", "native:browser"],
      ["/Documents/sprint5.png", "native:photos"],
      ["/Documents/sprint5.mp4", "native:video"],
    ] as const) {
      const result = await environment.os.open(path);
      expect(result.handlerId).toBe(handlerId);
      expect(result.processId).toBeDefined();
      expect(result.windowId).toBeDefined();
      expect(environment.os.processes.list().some(
        (process) => process.id === result.processId && process.handlerId === handlerId,
      )).toBe(true);
      expect(environment.os.windows.list().some(
        (window) => window.id === result.windowId && window.processId === result.processId,
      )).toBe(true);

      closeProcesses(environment);
    }
  } finally {
    environment.dispose();
  }
});
