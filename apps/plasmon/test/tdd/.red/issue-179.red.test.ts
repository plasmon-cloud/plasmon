import { expect, test } from "bun:test";
import { DocumentSession } from "../../../src/native-apps/text/document.ts";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

for (const [kind, name, mime] of [
  ["Text", "autosave-off.txt", "text/plain"],
  ["Markdown", "autosave-off.md", "text/markdown"],
] as const) {
  test(`#179 default ${kind} session does not write after the legacy debounce`, async () => {
    const environment = createHeadlessPlasmonEnvironment();
    try {
      await environment.ready;
      const documents = await environment.node("/Documents");
      if (!documents) throw new Error("Documents directory is unavailable");
      const file = await environment.services.fs.createFile(documents.id, name, { mime });
      await environment.services.fs.write(file.id, encoder.encode("before"), { truncate: true });
      const session = new DocumentSession(environment.services.fs, { autosaveMs: 15 });
      await session.setTarget(file.id);
      session.edit("after");
      await wait(40);
      expect(decoder.decode(await environment.services.fs.read(file.id))).toBe("before");
      expect(session.snapshot().dirty).toBe(true);
      session.dispose();
    } finally {
      environment.dispose();
    }
  });
}
