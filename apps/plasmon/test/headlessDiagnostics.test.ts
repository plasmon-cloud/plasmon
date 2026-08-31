import { describe, expect, test } from "bun:test";
import { SYSTEM_LOG_PATH } from "../src/os/diagnostics/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";
import { observeDiagnostics } from "./diagnosticObserver.ts";

describe("headless production diagnostics", () => {
  test("persists a protected system.log and observes structured records deterministically", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const diagnostics = observeDiagnostics(env.diagnostics);
    try {
      await env.ready;
      env.diagnostics.emit({
        level: "notice",
        subsystem: "test",
        event: "diagnostics.integration.probe",
        message: "headless diagnostic probe",
        correlationId: "diagnostics-probe-1",
      });

      expect(await diagnostics.settle({
        subsystem: "test",
        event: "diagnostics.integration.probe",
        level: "notice",
        correlationId: "diagnostics-probe-1",
      })).toHaveLength(1);
      expect(diagnostics.records({ correlationId: "different-correlation" })).toEqual([]);

      const resource = await env.os.fs.stat(SYSTEM_LOG_PATH);
      expect(resource).not.toBeNull();
      expect(resource?.mimeType).toBe("text/plain");
      expect((await env.os.fs.readText(SYSTEM_LOG_PATH)).length).toBeGreaterThan(0);

      const opened = await env.os.open(SYSTEM_LOG_PATH);
      expect(opened.handlerId).toBe("native:text");
      expect(opened.processId).toBeDefined();
      expect(opened.windowId).toBeDefined();

      await expect(env.os.fs.writeText(SYSTEM_LOG_PATH, "tampered"))
        .rejects.toThrow(/protected|system-managed/i);
    } finally {
      diagnostics.dispose();
      env.dispose();
    }
  });

  test("retains a Product lifecycle failure alongside the primary behavior assertion", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const diagnostics = observeDiagnostics(env.diagnostics);
    try {
      await env.ready;
      await diagnostics.settle();
      const opened = await env.os.open(SYSTEM_LOG_PATH);
      if (!opened.processId) throw new Error("system.log did not create a native process");

      const unregister = env.services.process.registerCloseHandler(opened.processId, () => {
        throw new TypeError("representative close-handler failure");
      });
      try {
        expect(env.services.process.close(opened.processId)).toBe(false);
        expect(env.processes().some((process) => process.id === opened.processId)).toBe(true);

        const failures = await diagnostics.settle({
          subsystem: "process",
          event: "process.close.handler-failed",
          level: "error",
        });
        expect(failures).toHaveLength(1);
        expect(failures[0]?.context).toMatchObject({
          appId: "native:text",
          handlerId: "native:text",
          processId: opened.processId,
        });
      } finally {
        unregister();
        env.services.process.forceClose(opened.processId);
      }
    } finally {
      diagnostics.dispose();
      env.dispose();
    }
  });
});
