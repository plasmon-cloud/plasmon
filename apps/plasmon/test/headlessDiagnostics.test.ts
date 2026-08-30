import { describe, expect, test } from "bun:test";
import { SYSTEM_LOG_PATH } from "../src/os/diagnostics/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

describe("headless production diagnostics", () => {
  test("persists a protected system.log and opens it through normal associations", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const observed: string[] = [];
      const unsubscribe = env.diagnostics.subscribe((record) => observed.push(record.event));
      env.diagnostics.emit({
        level: "notice",
        subsystem: "test",
        event: "diagnostics.integration.probe",
        message: "headless diagnostic probe",
      });
      await env.diagnostics.flush();
      unsubscribe();

      expect(observed).toContain("diagnostics.integration.probe");
      const resource = await env.os.fs.stat(SYSTEM_LOG_PATH);
      expect(resource).not.toBeNull();
      expect(resource?.mimeType).toBe("text/plain");
      expect(await env.os.fs.readText(SYSTEM_LOG_PATH)).toContain("diagnostics.integration.probe");

      const opened = await env.os.open(SYSTEM_LOG_PATH);
      expect(opened.handlerId).toBe("native:text");
      expect(opened.processId).toBeDefined();
      expect(opened.windowId).toBeDefined();

      await expect(env.os.fs.writeText(SYSTEM_LOG_PATH, "tampered"))
        .rejects.toThrow(/protected|system-managed/i);
    } finally {
      env.dispose();
    }
  });
});
