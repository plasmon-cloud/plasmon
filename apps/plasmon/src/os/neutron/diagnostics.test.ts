import { describe, expect, test } from "bun:test";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
import type { VanillaNeutronApi } from "./types.ts";
import { VanillaNeutronBridge } from "./vanilla.ts";

function api(overrides: Partial<VanillaNeutronApi> = {}): VanillaNeutronApi {
  return {
    listApps: async () => ({ apps: [] }),
    describeApp: async (appId) => ({ id: appId, name: appId, tiles: [] }),
    listEndpoints: async () => ({ endpoints: [] }),
    openAppTile: async () => ({}),
    offerAppInstall: async () => ({}),
    ...overrides,
  };
}

function diagnosticsHarness() {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const diagnostics = new PlasmonDiagnosticService({
    fs,
    console: null,
    operationIdFactory: () => "generated-operation",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  return { diagnostics, records };
}

describe("Neutron diagnostics", () => {
  test("correlates Kernel launch rejection without serializing the provider error", async () => {
    const { diagnostics, records } = diagnosticsHarness();
    const operation = diagnostics.startOperation({
      correlationId: "correlation-662",
      operationId: "open-662",
    });
    const bridge = new VanillaNeutronBridge({
      diagnostics,
      lifecycleTargets: {},
      resolveIcon: () => undefined,
      api: api({
        listApps: async () => ({ apps: [{ id: "sheet", description: "Spreadsheet" }] }),
        describeApp: async () => ({
          id: "sheet",
          name: "Spreadsheet",
          version: 403,
          tiles: [{ id: "main", title: "Spreadsheet" }],
        }),
        openAppTile: async () => {
          throw new TypeError("provider leaked https://example.invalid/app?token=secret-662");
        },
      }),
    });

    await expect(bridge.openElement("sheet", { operation: operation.context })).rejects.toThrow();
    await diagnostics.flush();

    const record = records.find((candidate) => candidate.event === "neutron.open.failed");
    expect(record).toMatchObject({
      level: "error",
      subsystem: "neutron",
      correlationId: "correlation-662",
      operationId: "open-662",
      context: {
        operation: "kernel:workspace.open_tile",
        runtime: "neutron",
        stage: "kernel-open-tile",
        appId: "sheet",
        appVersion: 403,
        errorKind: "TypeError",
      },
    });
    expect(JSON.stringify(record)).not.toContain("secret-662");
    expect(JSON.stringify(record)).not.toContain("example.invalid");
  });

  test("keeps metadata and runtime-state fallback diagnostics bounded and nonfatal", async () => {
    const { diagnostics, records } = diagnosticsHarness();
    const bridge = new VanillaNeutronBridge({
      diagnostics,
      lifecycleTargets: {},
      resolveIcon: () => undefined,
      api: api({
        listApps: async () => ({ apps: [{ id: "files", description: "Fallback files" }] }),
        describeApp: async () => {
          throw new Error("descriptor-secret");
        },
        listEndpoints: async () => {
          throw new Error("endpoint-secret");
        },
      }),
    });

    expect(await bridge.loadElements()).toEqual([{
      id: "files",
      name: "files",
      description: "Fallback files",
      tiles: [],
      running: "unknown",
    }]);
    await diagnostics.flush();

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "debug",
        subsystem: "neutron",
        event: "neutron.runtime.snapshot.failed",
        context: expect.objectContaining({ stage: "runtime-snapshot", errorKind: "Error" }),
      }),
      expect.objectContaining({
        level: "debug",
        subsystem: "neutron",
        event: "neutron.metadata.describe.failed",
        context: expect.objectContaining({ appId: "files", stage: "metadata", errorKind: "Error" }),
      }),
    ]));
    expect(JSON.stringify(records)).not.toContain("descriptor-secret");
    expect(JSON.stringify(records)).not.toContain("endpoint-secret");
  });

  test("never places a package install URL into diagnostics", async () => {
    const { diagnostics, records } = diagnosticsHarness();
    const bridge = new VanillaNeutronBridge({
      diagnostics,
      lifecycleTargets: {},
      api: api({
        offerAppInstall: async () => {
          throw new Error("install rejected");
        },
      }),
    });

    await expect(
      bridge.offerInstall("https://user:password@example.invalid/app.neutron?token=url-secret"),
    ).rejects.toThrow();
    await diagnostics.flush();

    const record = records.find((candidate) => candidate.event === "neutron.install-offer.failed");
    expect(record).toMatchObject({
      subsystem: "neutron",
      level: "error",
      context: {
        operation: "kernel:apps.offer_install",
        stage: "kernel-install-offer",
        errorKind: "Error",
      },
    });
    expect(JSON.stringify(record)).not.toContain("url-secret");
    expect(JSON.stringify(record)).not.toContain("password");
    expect(JSON.stringify(record)).not.toContain("example.invalid");
  });
});
