import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "../../../");
const read = (relativePath: string) => readFileSync(resolve(appRoot, relativePath), "utf8");

test("runtime diagnostics do not add tracing or diagnostics transport to Product launch contracts", () => {
  const productSurfaces = [
    read("src/os/contracts/neutron.ts"),
    read("src/os/contracts/process.ts"),
    read("src/os/process/runtime.ts"),
  ].join("\n");

  for (const forbidden of [
    "DiagnosticOperationContext",
    "startOperation",
    "continueOperation",
    "operationId",
    "parentOperationId",
    "diagnostics:",
    "diagnostics?:",
  ]) {
    expect(productSurfaces).not.toContain(forbidden);
  }
});

test("runtime boundary producers contain no routine started/completed lifecycle events", () => {
  const failureProducers = [
    read("src/os/neutron/vanilla.ts"),
    read("src/native-apps/shared/monaco/monacoEnvironment.ts"),
    read("src/native-apps/shared/monaco/MonacoEditorHost.tsx"),
    read("src/native-apps/jsdos/diagnostics.ts"),
    read("src/native-apps/emulatorjs/diagnostics.ts"),
  ].join("\n");

  expect(failureProducers).not.toMatch(/runtime\.[\w.-]+\.(?:started|completed)/);
  expect(failureProducers).not.toContain("startOperation");
  expect(failureProducers).not.toContain("continueOperation");
  expect(failureProducers).not.toContain("parentOperationId");
});

test("the Plasmon composition binds scoped runtime loggers without changing native-app props", () => {
  const os = read("src/os/PlasmonOS.tsx");
  const runtimeProps = read("src/os/process/runtime.ts");

  expect(os).toContain('services.diagnostics.for("runtime.monaco")');
  expect(os).toContain('services.diagnostics.for("runtime.jsdos")');
  expect(os).toContain('services.diagnostics.for("runtime.emulatorjs")');
  expect(os).toContain("setMonacoDiagnosticLogger(runtimeLogs.monaco)");
  expect(os).toContain("setJsDosDiagnosticLogger(runtimeLogs.jsDos)");
  expect(os).toContain("setEmulatorJsDiagnosticLogger(runtimeLogs.emulatorJs)");
  expect(runtimeProps).not.toContain("DiagnosticService");
  expect(runtimeProps).not.toContain("diagnostics");
});
