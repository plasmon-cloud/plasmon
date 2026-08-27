import { expect, test } from "bun:test";
import { EMULATORJS_NES_MIME } from "../src/native-apps/emulatorjs/runtime.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function emulatorFixture(): Uint8Array {
  const bytes = new Uint8Array(16 + 16_384);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x00], 0);
  return bytes;
}

test("#83 canonical associations select js-dos and EmulatorJS through the shared headless runtime path", async () => {
  const environment = createHeadlessPlasmonEnvironment();

  try {
    await environment.ready;
    const documents = await environment.node("/Documents");
    if (!documents || documents.kind !== "directory") {
      throw new Error("/Documents directory is unavailable");
    }

    const jsDos = await environment.services.fs.createFile(documents.id, "Quarterly Budget.bin", {
      mime: "application/x-jsdos",
    });
    const emulatorJs = await environment.services.fs.createFile(documents.id, "Meeting Notes.bin", {
      mime: EMULATORJS_NES_MIME,
    });
    await environment.services.fs.write(emulatorJs.id, emulatorFixture(), { truncate: true });

    const runtimeCases = [
      {
        node: jsDos,
        path: "/Documents/Quarterly Budget.bin",
        handlerId: "runtime:js-dos",
      },
      {
        node: emulatorJs,
        path: "/Documents/Meeting Notes.bin",
        handlerId: "runtime:emulatorjs",
      },
    ] as const;

    for (const candidate of runtimeCases) {
      const resolved = await environment.services.associations.resolve(candidate.node);
      expect(resolved[0]?.id).toBe(candidate.handlerId);
      expect(environment.processes()).toHaveLength(0);
      expect(environment.windows()).toHaveLength(0);

      await environment.open(candidate.path);

      const processes = environment.processes();
      const windows = environment.windows();
      expect(processes).toHaveLength(1);
      expect(windows).toHaveLength(1);
      expect(processes[0]).toMatchObject({
        handlerId: candidate.handlerId,
        target: expect.objectContaining({ nodeId: candidate.node.id }),
      });
      expect(windows[0]?.processId).toBe(processes[0]?.id);
      expect((await environment.node(candidate.path))?.id).toBe(candidate.node.id);

      environment.services.process.close(processes[0]!.id);
      expect(environment.processes()).toHaveLength(0);
      expect(environment.windows()).toHaveLength(0);
    }

    const unsupported = await environment.services.fs.createFile(documents.id, "Unsupported.asset", {
      mime: "application/x-plasmon-unsupported",
    });
    expect((await environment.services.associations.resolve(unsupported)).map(({ id }) => id)).toEqual([
      "native:text",
    ]);

    const ambiguous = await environment.services.fs.createFile(documents.id, "Ambiguous.jsdos", {
      mime: EMULATORJS_NES_MIME,
    });
    expect((await environment.services.associations.resolve(ambiguous)).map(({ id }) => id)).toEqual([
      "runtime:js-dos",
      "runtime:emulatorjs",
      "native:text",
    ]);
  } finally {
    environment.dispose();
  }
});
