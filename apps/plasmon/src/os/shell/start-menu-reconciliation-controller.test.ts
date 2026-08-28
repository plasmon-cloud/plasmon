import { expect, test } from "bun:test";
import type {
  ExternalElement,
  FsNode,
  FsService,
  NativeAppDefinition,
  NativeAppRegistry,
  NeutronBridge,
} from "../contracts/index.ts";
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

function element(id: string, name: string, running: ExternalElement["running"]): ExternalElement {
  return { id, name, description: name, tiles: [], running };
}

async function settleUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20 && !predicate(); index += 1) await Promise.resolve();
  if (!predicate()) throw new Error("controller did not settle");
}

test("#194 service controller reconciles native defaults before Element discovery and skips runtime-only churn", async () => {
  const native = [{ handlerId: "native:text", id: "text", name: "Text" }] as NativeAppDefinition[];
  const registry = { list: () => native } as NativeAppRegistry;
  let discovered = [element("review", "Review", "no")];
  const listeners = new Set<() => void>();
  const neutron: NeutronBridge = {
    loadElements: async () => discovered.map((entry) => ({ ...entry })),
    openElement: async () => {},
    offerInstall: async () => {},
    refreshRuntimeState: async () => {},
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const reconciled: string[][] = [];
  const controller = new StartMenuReconciliationController(
    {} as FsService,
    registry,
    neutron,
    {
      reconcile: async (_fs, _nativeApps, elements) => {
        reconciled.push(elements.map((entry) => `${entry.id}:${entry.name}:${entry.running}`));
        return { root: root(), created: 0, preserved: 0, skippedDeleted: 0 };
      },
    },
  );

  controller.start();
  await settleUntil(() => reconciled.length === 2);
  expect(reconciled).toEqual([[], ["review:Review:no"]]);
  expect(controller.getSnapshot().root?.id).toBe("start-root");

  discovered = [element("review", "Review", "yes")];
  for (const listener of [...listeners]) listener();
  await settleUntil(() => reconciled.length >= 2);
  await Promise.resolve();
  await Promise.resolve();
  expect(reconciled).toHaveLength(2);

  discovered = [element("review", "Review 2", "yes")];
  for (const listener of [...listeners]) listener();
  await settleUntil(() => reconciled.length === 3);
  expect(reconciled[2]).toEqual(["review:Review 2:yes"]);
  controller.dispose();
});

test("#194 reconciliation failures are observable and retried because failed identity is not accepted", async () => {
  const registry = { list: () => [] } as unknown as NativeAppRegistry;
  const listeners = new Set<() => void>();
  const neutron: NeutronBridge = {
    loadElements: async () => [],
    openElement: async () => {},
    offerInstall: async () => {},
    refreshRuntimeState: async () => {},
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  let attempts = 0;
  const controller = new StartMenuReconciliationController(
    {} as FsService,
    registry,
    neutron,
    {
      reconcile: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("blocked root");
        return { root: root(), created: 0, preserved: 0, skippedDeleted: 0 };
      },
    },
  );

  controller.start();
  await settleUntil(() => attempts >= 2);
  expect(attempts).toBe(2);
  expect(controller.getSnapshot()).toMatchObject({
    root: { id: "start-root" },
    error: null,
    revision: 2,
  });
  controller.dispose();
});
