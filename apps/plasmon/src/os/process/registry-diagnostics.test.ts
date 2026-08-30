import { expect, test } from "bun:test";
import type { FsService, NativeAppDefinition } from "../contracts/index.ts";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../diagnostics/index.ts";
import { NativeApplicationRegistry } from "./registry.ts";

function app(id = "native:test", handlerId = "native:test"): NativeAppDefinition {
  return {
    id,
    handlerId,
    name: "Test",
    icon: "system:test",
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

function diagnosticRecords(): {
  diagnostics: PlasmonDiagnosticService;
  records: DiagnosticRecord[];
} {
  const diagnostics = new PlasmonDiagnosticService({
    fs: {} as FsService,
    fileMinLevel: "critical",
    consoleMinLevel: "critical",
    console: null,
    now: () => 123,
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  return { diagnostics, records };
}

test("registry reports bounded registration failures through the canonical scoped logger", () => {
  const { diagnostics, records } = diagnosticRecords();
  const registry = new NativeApplicationRegistry({ diagnostics: diagnostics.for("native-app") });
  registry.register(app());

  expect(() => registry.register(app())).toThrow("already registered");
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    subsystem: "native-app",
    event: "native-app.registration.failed",
    context: {
      appId: "native:test",
      handlerId: "native:test",
      reason: "duplicate-app-id",
    },
  });
});

test("loader rejection is reported once, remains retryable, and does not expose the error message", async () => {
  const { diagnostics, records } = diagnosticRecords();
  const registry = new NativeApplicationRegistry({ diagnostics: diagnostics.for("native-app") });
  const privateSentinel = "/Users/private/Documents/customer-secret.txt?token=super-secret";
  const failure = new TypeError(privateSentinel);
  let attempts = 0;
  registry.registerWithLoader(app(), async () => {
    attempts += 1;
    if (attempts === 1) throw failure;
    return { default: () => null };
  });

  await expect(registry.loadComponent("native:test")).rejects.toBe(failure);
  expect(registry.isLoadFailure("native:test", failure)).toBe(true);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    subsystem: "native-app",
    event: "native-app.load.failed",
    context: {
      appId: "native:test",
      reason: "loader-rejected",
      errorType: "TypeError",
    },
  });
  expect(JSON.stringify(records)).not.toContain(privateSentinel);

  await expect(registry.loadComponent("native:test")).resolves.toBeTypeOf("function");
  expect(attempts).toBe(2);
  expect(records).toHaveLength(1);
});

test("missing host loader is classified as a load failure rather than an application crash", async () => {
  const { diagnostics, records } = diagnosticRecords();
  const registry = new NativeApplicationRegistry({ diagnostics: diagnostics.for("native-app") });
  registry.register(app());

  let failure: unknown;
  try {
    await registry.loadComponent("native:test");
  } catch (error: unknown) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(registry.isLoadFailure("native:test", failure)).toBe(true);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    event: "native-app.load.failed",
    context: { reason: "missing-loader" },
  });
});
