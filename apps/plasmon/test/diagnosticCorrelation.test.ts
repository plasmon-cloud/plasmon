import { describe, expect, test } from "bun:test";
import type { DiagnosticRecord } from "../src/os/diagnostics/index.ts";
import { SYSTEM_LOG_PATH } from "../src/os/diagnostics/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function byEvent(records: readonly DiagnosticRecord[], event: string): DiagnosticRecord {
  const record = records.find((candidate) => candidate.event === event);
  if (!record) throw new Error(`Missing diagnostic event: ${event}`);
  return record;
}

describe("cross-system diagnostic correlation", () => {
  test("follows one OS open through the API and canonical open router", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const target = await env.os.fs.writeText("/Desktop/correlation-open.txt", "safe fixture");
      await env.diagnostics.flush();

      const records: DiagnosticRecord[] = [];
      const unsubscribe = env.diagnostics.subscribe((record) => records.push(record));
      const opened = await env.os.open(target.path);
      await env.diagnostics.flush();
      unsubscribe();

      expect(opened.handlerId).toBe("native:text");
      expect(opened.processId).toBeDefined();
      expect(opened.windowId).toBeDefined();

      const apiStarted = byEvent(records, "os.open.started");
      const routed = byEvent(records, "open.handler.completed");
      const apiCompleted = byEvent(records, "os.open.completed");
      expect(apiStarted.subsystem).toBe("os-api");
      expect(routed.subsystem).toBe("open");
      expect(apiCompleted.subsystem).toBe("os-api");
      expect(apiStarted.correlationId).toBeDefined();
      expect(apiStarted.operationId).toBeDefined();
      expect(new Set([apiStarted.correlationId, routed.correlationId, apiCompleted.correlationId])).toEqual(
        new Set([apiStarted.correlationId]),
      );
      expect(new Set([apiStarted.operationId, routed.operationId, apiCompleted.operationId])).toEqual(
        new Set([apiStarted.operationId]),
      );

      const text = await env.os.fs.readText(SYSTEM_LOG_PATH);
      expect(text).toContain("open.handler.completed");
      expect(text).toContain(`correlation=${apiStarted.correlationId}`);
      expect(text).toContain(`operation=${apiStarted.operationId}`);
    } finally {
      env.dispose();
    }
  });

  test("correlates a filesystem write without uploading its path or contents", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const records: DiagnosticRecord[] = [];
      const unsubscribe = env.diagnostics.subscribe((record) => records.push(record));
      const path = "/Desktop/private-correlation-path.txt";
      const content = "private-correlation-document-content";

      const written = await env.os.fs.writeText(path, content);
      await env.diagnostics.flush();
      unsubscribe();

      const started = byEvent(records, "os.fs.write.started");
      const completed = byEvent(records, "os.fs.write.completed");
      expect(written.path).toBe(path);
      expect(started.correlationId).toBeDefined();
      expect(started.correlationId).toBe(completed.correlationId);
      expect(started.operationId).toBe(completed.operationId);
      expect(completed.context).toMatchObject({ nodeId: written.id, created: true });

      const serialized = JSON.stringify(records.filter((record) => record.event.startsWith("os.fs.write.")));
      expect(serialized).not.toContain(path);
      expect(serialized).not.toContain(content);
      const text = await env.os.fs.readText(SYSTEM_LOG_PATH);
      expect(text).toContain("os.fs.write.completed");
      expect(text).not.toContain(path);
      expect(text).not.toContain(content);
    } finally {
      env.dispose();
    }
  });

  test("does not reuse correlation identity across unrelated operations", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const left = await env.os.fs.writeText("/Desktop/correlation-left.txt", "left");
      const right = await env.os.fs.writeText("/Desktop/correlation-right.txt", "right");
      await env.diagnostics.flush();

      const records: DiagnosticRecord[] = [];
      const unsubscribe = env.diagnostics.subscribe((record) => records.push(record));
      await Promise.all([env.os.open(left.path), env.os.open(right.path)]);
      unsubscribe();

      const starts = records.filter((record) => record.event === "os.open.started");
      expect(starts).toHaveLength(2);
      expect(starts[0]?.correlationId).toBeDefined();
      expect(starts[1]?.correlationId).toBeDefined();
      expect(starts[0]?.correlationId).not.toBe(starts[1]?.correlationId);
      expect(starts[0]?.operationId).not.toBe(starts[1]?.operationId);
    } finally {
      env.dispose();
    }
  });
});
