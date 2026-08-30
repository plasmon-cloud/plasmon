import { describe, expect, test } from "bun:test";
import type { FsService } from "../contracts/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
import {
  PlasmonDiagnosticService,
  SYSTEM_LOG_PATH,
  type DiagnosticConsole,
  type DiagnosticRecord,
} from "./service.ts";

function createFs(): PersistentFsService {
  let nextId = 0;
  return new PersistentFsService(new MemoryFsRepository(), {
    now: () => 1_700_000_000_000,
    randomUUID: () => `10000000-0000-4000-8000-${(++nextId).toString().padStart(12, "0")}`,
  });
}

async function readSystemLog(fs: FsService): Promise<string> {
  const node = await fs.resolvePath(SYSTEM_LOG_PATH);
  if (!node) throw new Error("system.log was not created");
  return new TextDecoder().decode(await fs.read(node.id));
}

describe("diagnostic operations", () => {
  test("keeps immutable root/child identity and isolates unrelated async operations", async () => {
    const ids = ["correlation-a", "operation-a", "operation-child", "correlation-b", "operation-b"];
    const consoleLines: string[] = [];
    const diagnosticConsole: DiagnosticConsole = {
      debug: (...data) => consoleLines.push(data.join(" ")),
      info: (...data) => consoleLines.push(data.join(" ")),
      warn: (...data) => consoleLines.push(data.join(" ")),
      error: (...data) => consoleLines.push(data.join(" ")),
    };
    const fs = createFs();
    const diagnostics = new PlasmonDiagnosticService({
      fs,
      console: diagnosticConsole,
      consoleMinLevel: "debug",
      fileMinLevel: "debug",
      operationIdFactory: () => {
        const next = ids.shift();
        if (!next) throw new Error("operation id fixture exhausted");
        return next;
      },
    });
    const observed: DiagnosticRecord[] = [];
    diagnostics.subscribe((record) => observed.push(record));

    const root = diagnostics.startOperation();
    const child = root.child();
    const other = diagnostics.startOperation();

    expect(root.context).toEqual({ correlationId: "correlation-a", operationId: "operation-a" });
    expect(child.context).toEqual({
      correlationId: "correlation-a",
      operationId: "operation-child",
      parentOperationId: "operation-a",
    });
    expect(other.context).toEqual({ correlationId: "correlation-b", operationId: "operation-b" });
    expect(Object.isFrozen(root.context)).toBe(true);

    await Promise.all([
      Promise.resolve().then(() => root.for("open").warn("open.root.probe")),
      Promise.resolve().then(() => other.for("filesystem").warn("filesystem.other.probe")),
    ]);
    child.for("process").error("process.child.probe", { error: new Error("probe") });
    await diagnostics.flush();

    const rootRecord = observed.find((record) => record.event === "open.root.probe");
    const childRecord = observed.find((record) => record.event === "process.child.probe");
    const otherRecord = observed.find((record) => record.event === "filesystem.other.probe");
    expect(rootRecord).toMatchObject({
      correlationId: "correlation-a",
      operationId: "operation-a",
    });
    expect(childRecord).toMatchObject({
      correlationId: "correlation-a",
      operationId: "operation-child",
      parentOperationId: "operation-a",
    });
    expect(otherRecord).toMatchObject({
      correlationId: "correlation-b",
      operationId: "operation-b",
    });

    const sinks = `${await readSystemLog(fs)}\n${consoleLines.join("\n")}`;
    expect(sinks).toContain("correlation=correlation-a");
    expect(sinks).toContain("operation=operation-child");
    expect(sinks).toContain("parentOperation=operation-a");
    expect(sinks).toContain("correlation=correlation-b");
  });

  test("continues an explicit context and still permits an event-level override", () => {
    const fs = createFs();
    const diagnostics = new PlasmonDiagnosticService({ fs, console: null });
    const operation = diagnostics.continueOperation({
      correlationId: "incoming-correlation",
      operationId: "incoming-operation",
      parentOperationId: "incoming-parent",
    });

    const inherited = operation.for("open").info("open.inherited");
    const overridden = operation.for("open").info("open.overridden", {
      correlationId: "explicit-correlation",
    });

    expect(inherited).toMatchObject({
      correlationId: "incoming-correlation",
      operationId: "incoming-operation",
      parentOperationId: "incoming-parent",
    });
    expect(overridden.correlationId).toBe("explicit-correlation");
    expect(overridden.operationId).toBe("incoming-operation");
  });
});
