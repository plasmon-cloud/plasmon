import { expect, test } from "bun:test";
import { EMULATORJS_NES_MIME } from "../src/native-apps/emulatorjs/runtime.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function testRom(): Uint8Array {
  const bytes = new Uint8Array(16 + 16_384);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x00], 0);
  return bytes;
}

test("filesystem .nes opens through associations into the EmulatorJS process/window host", async () => {
  const environment = createHeadlessPlasmonEnvironment();

  try {
    await environment.ready;
    const documents = await environment.node("/Documents");
    expect(documents?.kind).toBe("directory");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

    const rom = await environment.services.fs.createFile(documents.id, "Fixture.nes", {
      mime: EMULATORJS_NES_MIME,
    });
    await environment.services.fs.write(rom.id, testRom(), { truncate: true });

    expect((await environment.services.associations.resolve(rom))[0]?.id).toBe("runtime:emulatorjs");

    await environment.open("/Documents/Fixture.nes");

    const processes = environment.processes();
    expect(processes).toHaveLength(1);
    expect(processes[0]?.handlerId).toBe("runtime:emulatorjs");
    expect(processes[0]?.target.nodeId).toBe(rom.id);
    expect(processes[0]?.windowId).toBe("window:test:1");

    const windows = environment.windows();
    expect(windows).toHaveLength(1);
    expect(windows[0]?.processId).toBe(processes[0]?.id);

    environment.services.process.close(processes[0]!.id);
    expect(environment.processes()).toHaveLength(0);
    expect(environment.windows()).toHaveLength(0);
  } finally {
    environment.dispose();
  }
});
