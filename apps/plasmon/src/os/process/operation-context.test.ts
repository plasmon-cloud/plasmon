import { expect, test } from "bun:test";
import type { DiagnosticOperationContext, NativeAppDefinition } from "../contracts/index.ts";
import { NativeWindowManager } from "../windowing/NativeWindowManager.ts";
import { NativeProcessController } from "./controller.ts";
import { NativeApplicationRegistry } from "./registry.ts";

const definition: NativeAppDefinition = {
  id: "runtime:test",
  handlerId: "runtime:test",
  name: "Runtime Test",
  icon: "system:test",
  defaultWindow: { width: 640, height: 480 },
  associations: [],
};

test("native process records retain only the explicitly supplied diagnostic operation", async () => {
  const registry = new NativeApplicationRegistry();
  registry.register(definition);
  const process = new NativeProcessController(registry, new NativeWindowManager());
  const operation: DiagnosticOperationContext = Object.freeze({
    correlationId: "correlation-662",
    operationId: "open-662",
    parentOperationId: "filesystem-open-662",
  });

  const processId = await process.open("runtime:test", { url: "about:blank" }, operation);
  expect(processId).not.toBeNull();
  expect(process.list().find((record) => record.id === processId)?.operation).toEqual(operation);

  const unrelatedId = await process.open("runtime:test", { url: "about:blank" });
  expect(unrelatedId).not.toBeNull();
  expect(process.list().find((record) => record.id === unrelatedId)?.operation).toBeUndefined();

  process.dispose();
});
