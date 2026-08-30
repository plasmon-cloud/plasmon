import { describe, expect, test } from "bun:test";
import type { FsService } from "../contracts/index.ts";
import {
  FS_TOOLS,
  FsRpcClient,
  FsRpcServer,
  MemoryFsRepository,
  PersistentFsService,
} from "../fs/index.ts";
import {
  PlasmonDiagnosticService,
  SYSTEM_LOG_PATH,
  retainNewestDiagnosticLines,
  type DiagnosticConsole,
} from "./service.ts";

function createFs(): PersistentFsService {
  let nextId = 0;
  return new PersistentFsService(new MemoryFsRepository(), {
    now: () => 1_700_000_000_000,
    randomUUID: () => `00000000-0000-4000-8000-${(++nextId).toString().padStart(12, "0")}`,
  });
}

async function readSystemLog(fs: FsService): Promise<string> {
  const node = await fs.resolvePath(SYSTEM_LOG_PATH);
  if (!node) throw new Error("system.log was not created");
  return new TextDecoder().decode(await fs.read(node.id));
}

describe("PlasmonDiagnosticService", () => {
  test("persists structured events to the canonical filesystem log", async () => {
    const fs = createFs();
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: null,
      now: () => Date.UTC(2026, 7, 30, 3, 30, 0),
    });

    diagnostics.emit({
      level: "notice",
      subsystem: "filesystem",
      event: "filesystem.bootstrap.ready",
      message: "Filesystem bootstrap completed",
      correlationId: "boot-1",
      context: { revision: "42", seeded: 3 },
    });
    await diagnostics.flush();

    const logNode = await fs.resolvePath(SYSTEM_LOG_PATH);
    expect(logNode?.mime).toBe("text/plain");
    const text = await readSystemLog(fs);
    expect(text).toContain("2026-08-30T03:30:00.000Z | NOTICE | [filesystem]");
    expect(text).toContain("filesystem.bootstrap.ready");
    expect(text).toContain("correlation=boot-1");
    expect(text).toContain('context={"revision":"42","seeded":3}');
  });

  test("redacts sensitive keys and common token forms before any sink sees them", async () => {
    const fs = createFs();
    const consoleLines: string[] = [];
    const diagnosticConsole: DiagnosticConsole = {
      debug: (...data) => consoleLines.push(data.join(" ")),
      info: (...data) => consoleLines.push(data.join(" ")),
      warn: (...data) => consoleLines.push(data.join(" ")),
      error: (...data) => consoleLines.push(data.join(" ")),
    };
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: diagnosticConsole,
      consoleMinLevel: "debug",
      fileMinLevel: "debug",
    });

    diagnostics.emit({
      level: "error",
      subsystem: "neutron",
      event: "neutron.request.failed",
      message: "request failed?access_token=message-secret",
      context: {
        token: "context-secret",
        nested: { authorization: "Bearer nested-secret", safe: "visible" },
      },
      error: new Error("Bearer error-secret"),
    });
    await diagnostics.flush();

    const combined = `${await readSystemLog(fs)}\n${consoleLines.join("\n")}`;
    expect(combined).toContain("[REDACTED]");
    expect(combined).toContain("visible");
    expect(combined).not.toContain("message-secret");
    expect(combined).not.toContain("context-secret");
    expect(combined).not.toContain("nested-secret");
    expect(combined).not.toContain("error-secret");
  });

  test("retains the newest complete records when the log exceeds its byte ceiling", async () => {
    const fs = createFs();
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: null,
      maxBytes: 420,
      retainBytes: 240,
    });

    for (let index = 0; index < 8; index += 1) {
      diagnostics.emit({
        level: "warn",
        subsystem: "test",
        event: `retention.${index}`,
        message: `record-${index}-${"x".repeat(48)}`,
      });
    }
    await diagnostics.flush();

    const text = await readSystemLog(fs);
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(420);
    expect(text).toContain("retention.7");
    expect(text).not.toContain("retention.0");
  });

  test("preserves record identity and valid UTF-8 when one newest record exceeds the byte ceiling", () => {
    const prefix = "2026-08-30T03:30:00.000Z | ERROR | [runtime] | runtime.start.failed | ";
    const text = `${prefix}${"😀".repeat(100)}\n`;
    const retained = retainNewestDiagnosticLines(text, 128, 96);

    expect(new TextEncoder().encode(retained).byteLength).toBeLessThanOrEqual(128);
    expect(retained.startsWith(prefix)).toBe(true);
    expect(retained).toContain("runtime.start.failed");
    expect(retained.endsWith(" …[TRUNCATED]\n")).toBe(true);
    expect(retained).not.toContain("�");
  });

  test("retries a transient RPC read conflict without losing, duplicating, or reordering records", async () => {
    const backingFs = createFs();
    const server = new FsRpcServer(backingFs);
    const sinkFailures: unknown[] = [];
    let conflictNextReadChunk = false;
    let observedTransientConflicts = 0;
    const encoder = new TextEncoder();

    const fs = new FsRpcClient(async (name, args) => {
      if (name === FS_TOOLS.readChunk && conflictNextReadChunk) {
        conflictNextReadChunk = false;
        const logNode = await backingFs.resolvePath(SYSTEM_LOG_PATH);
        if (!logNode) throw new Error("expected system.log before forced read conflict");
        const current = await backingFs.read(logNode.id);
        const concurrentLine = encoder.encode("external-concurrent-write\n");
        const changed = new Uint8Array(current.length + concurrentLine.length);
        changed.set(current);
        changed.set(concurrentLine, current.length);
        await backingFs.write(logNode.id, changed, { truncate: true });
      }

      try {
        return await server.call(name, args);
      } catch (error) {
        if (
          error instanceof Error
          && error.message === "Filesystem changed during read; retry the operation"
        ) {
          observedTransientConflicts += 1;
        }
        throw error;
      }
    });
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: null,
      fileMinLevel: "debug",
      onSinkError: (error) => sinkFailures.push(error),
    });

    diagnostics.emit({
      level: "info",
      subsystem: "test",
      event: "diagnostics.retry.seed",
      message: "seed the diagnostic log",
    });
    await diagnostics.flush();

    conflictNextReadChunk = true;
    diagnostics.emit({
      level: "info",
      subsystem: "test",
      event: "diagnostics.retry.first",
      message: "first queued record",
    });
    diagnostics.emit({
      level: "info",
      subsystem: "test",
      event: "diagnostics.retry.second",
      message: "second queued record",
    });
    await diagnostics.flush();

    expect(observedTransientConflicts).toBe(1);
    expect(sinkFailures).toEqual([]);

    const text = await readSystemLog(fs);
    expect(text).toContain("external-concurrent-write");
    expect(text.split("diagnostics.retry.first")).toHaveLength(2);
    expect(text.split("diagnostics.retry.second")).toHaveLength(2);
    expect(text.indexOf("diagnostics.retry.first")).toBeLessThan(
      text.indexOf("diagnostics.retry.second"),
    );
  });

  test("isolates filesystem sink failures from event producers", async () => {
    const failures: unknown[] = [];
    const brokenFs = {
      resolvePath: async () => {
        throw new Error("filesystem unavailable");
      },
    } as unknown as FsService;
    const diagnostics = new PlasmonDiagnosticService({
      fs: brokenFs,
      console: null,
      onSinkError: (error) => failures.push(error),
    });

    const record = diagnostics.emit({
      level: "error",
      subsystem: "filesystem",
      event: "filesystem.write.failed",
      message: "A write failed",
    });
    expect(record.event).toBe("filesystem.write.failed");
    await expect(diagnostics.flush()).resolves.toBeUndefined();
    expect(failures).toHaveLength(1);
  });

  test("filters console output independently from filesystem severity", async () => {
    const fs = createFs();
    const calls: string[] = [];
    const diagnosticConsole: DiagnosticConsole = {
      debug: (...data) => calls.push(`debug:${data.join(" ")}`),
      info: (...data) => calls.push(`info:${data.join(" ")}`),
      warn: (...data) => calls.push(`warn:${data.join(" ")}`),
      error: (...data) => calls.push(`error:${data.join(" ")}`),
    };
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: diagnosticConsole,
      fileMinLevel: "debug",
      consoleMinLevel: "warn",
    });

    diagnostics.emit({ level: "debug", subsystem: "test", event: "debug", message: "debug" });
    diagnostics.emit({ level: "warn", subsystem: "test", event: "warn", message: "warn" });
    await diagnostics.flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("warn:");
    const text = await readSystemLog(fs);
    expect(text).toContain("| DEBUG |");
    expect(text).toContain("| WARN |");
  });
});
