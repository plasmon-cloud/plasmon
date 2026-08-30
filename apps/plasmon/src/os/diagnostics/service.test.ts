import { describe, expect, test } from "bun:test";
import type { FsService } from "../contracts/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
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

  test("scoped producer helpers preserve severity, subsystem, reserved metadata, and safe context", async () => {
    const fs = createFs();
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: null,
      fileMinLevel: "debug",
    });
    const observed: string[] = [];
    diagnostics.subscribe((record) => observed.push(`${record.level}:${record.subsystem}:${record.event}`));
    const log = diagnostics.for("filesystem");

    const record = log.error("file.write.failed", {
      message: "Filesystem write failed",
      correlationId: "open-42",
      path: "/Documents/example.txt",
      attempt: 2,
      error: new Error("disk unavailable"),
    });
    log.info("file.move.completed", { count: 3 });
    await diagnostics.flush();

    expect(log.subsystem).toBe("filesystem");
    expect(record.level).toBe("error");
    expect(record.subsystem).toBe("filesystem");
    expect(record.event).toBe("file.write.failed");
    expect(record.message).toBe("Filesystem write failed");
    expect(record.correlationId).toBe("open-42");
    expect(record.context).toEqual({ attempt: 2, path: "/Documents/example.txt" });
    expect(record.error?.message).toBe("disk unavailable");
    expect(observed).toEqual([
      "error:filesystem:file.write.failed",
      "info:filesystem:file.move.completed",
    ]);
    const text = await readSystemLog(fs);
    expect(text).toContain("file.write.failed");
    expect(text).toContain("file.move.completed");
    expect(text).toContain('context={"attempt":2,"path":"/Documents/example.txt"}');
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
