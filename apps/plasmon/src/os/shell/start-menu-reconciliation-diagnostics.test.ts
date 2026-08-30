import { expect, test } from "bun:test";
import type {
  FsNode,
  FsService,
  NativeAppRegistry,
  NeutronBridge,
} from "../contracts/index.ts";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../diagnostics/index.ts";
import { StartMenuReconciliationController } from "./start-menu-reconciliation-controller.ts";

function root(): FsNode {
  return {
    id: "start-root",
    parentId: "system",
    name: "Start Menu",
    kind: "directory",
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
  } as FsNode;
}

function recorder(): { diagnostics: PlasmonDiagnosticService; records: DiagnosticRecord[] } {
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

async function settleUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20 && !predicate(); index += 1) await Promise.resolve();
  if (!predicate()) throw new Error("controller did not settle");
}

test("Start reports its own reconciliation failure without exposing the underlying message", async () => {
  const { diagnostics, records } = recorder();
  const privateSentinel = "/System/private/customer-name?token=secret";
  const registry = { list: () => [] } as unknown as NativeAppRegistry;
  const neutron: NeutronBridge = {
    loadElements: async () => { throw new Error("neutron discovery unavailable"); },
    openElement: async () => {},
    offerInstall: async () => {},
    refreshRuntimeState: async () => {},
    subscribe: () => () => {},
  };
  const controller = new StartMenuReconciliationController(
    {} as FsService,
    registry,
    neutron,
    {
      diagnostics: diagnostics.for("shell"),
      reconcile: async () => { throw new TypeError(privateSentinel); },
    },
  );

  controller.start();
  await settleUntil(() => records.length === 1);
  expect(records[0]).toMatchObject({
    subsystem: "shell",
    event: "shell.start.reconcile.failed",
    context: { errorType: "TypeError" },
  });
  expect(JSON.stringify(records)).not.toContain(privateSentinel);
  expect(controller.getSnapshot().error).toContain(privateSentinel);
  controller.dispose();
});

test("Neutron discovery degradation does not masquerade as a Start reconciliation failure", async () => {
  const { diagnostics, records } = recorder();
  const registry = { list: () => [] } as unknown as NativeAppRegistry;
  let reconciled = 0;
  const neutron: NeutronBridge = {
    loadElements: async () => { throw new Error("neutron discovery unavailable"); },
    openElement: async () => {},
    offerInstall: async () => {},
    refreshRuntimeState: async () => {},
    subscribe: () => () => {},
  };
  const controller = new StartMenuReconciliationController(
    {} as FsService,
    registry,
    neutron,
    {
      diagnostics: diagnostics.for("shell"),
      reconcile: async () => {
        reconciled += 1;
        return { root: root(), created: 0, preserved: 0, skippedDeleted: 0 };
      },
    },
  );

  controller.start();
  await settleUntil(() => reconciled === 1);
  await Promise.resolve();
  await Promise.resolve();
  expect(records).toEqual([]);
  expect(controller.getSnapshot().error).toBeNull();
  controller.dispose();
});
