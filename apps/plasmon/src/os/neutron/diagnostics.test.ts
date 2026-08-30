import { describe, expect, test } from "bun:test";
import {
  DiagnosticOperation,
  DiagnosticStage,
  PlasmonDiagnosticService,
  type DiagnosticRecord,
} from "../diagnostics/index.ts";
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
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  return { diagnostics, records };
}

describe("Neutron boundary diagnostics", () => {
  test("reports discovery and parse failures without inventing Kernel root cause", async () => {
    const first = diagnosticsHarness();
    const rejected = new VanillaNeutronBridge({
      diagnosticLogger: first.diagnostics.for("neutron"),
      lifecycleTargets: {},
      api: api({ listApps: async () => { throw new TypeError("provider-private-detail"); } }),
    });

    await expect(rejected.loadElements()).rejects.toThrow("provider-private-detail");
    expect(first.records).toEqual([
      expect.objectContaining({
        level: "error",
        subsystem: "neutron",
        event: "neutron.discovery.failed",
        context: {
          operation: DiagnosticOperation.Discover,
          stage: DiagnosticStage.Discovery,
          errorType: "TypeError",
        },
      }),
    ]);
    expect(JSON.stringify(first.records)).not.toContain("provider-private-detail");

    const second = diagnosticsHarness();
    const invalid = new VanillaNeutronBridge({
      diagnosticLogger: second.diagnostics.for("neutron"),
      lifecycleTargets: {},
      api: api({ listApps: async () => ({ unexpected: true }) }),
    });
    await expect(invalid.loadElements()).rejects.toThrow("invalid apps.list response");
    expect(second.records[0]).toMatchObject({
      event: "neutron.discovery.invalid",
      context: { operation: DiagnosticOperation.Discover, stage: DiagnosticStage.Parse, errorType: "Error" },
    });
  });

  test("reports open failure with stable stage and no provider payload", async () => {
    const { diagnostics, records } = diagnosticsHarness();
    const bridge = new VanillaNeutronBridge({
      diagnosticLogger: diagnostics.for("neutron"),
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
          throw new TypeError("provider-private-open-detail");
        },
      }),
    });

    await expect(bridge.openElement("sheet")).rejects.toThrow();
    const record = records.find((candidate) => candidate.event === "neutron.open.failed");
    expect(record).toMatchObject({
      level: "error",
      subsystem: "neutron",
      context: {
        operation: DiagnosticOperation.Open,
        stage: DiagnosticStage.KernelOpenTile,
        appId: "sheet",
        appVersion: 403,
        errorType: "TypeError",
      },
    });
    expect(JSON.stringify(record)).not.toContain("provider-private-open-detail");
  });

  test("never records a package install URL and stays quiet on success", async () => {
    const { diagnostics, records } = diagnosticsHarness();
    const bridge = new VanillaNeutronBridge({
      diagnosticLogger: diagnostics.for("neutron"),
      lifecycleTargets: {},
      resolveIcon: () => undefined,
      api: api({
        offerAppInstall: async () => { throw new Error("install-private-detail"); },
      }),
    });

    const sensitiveUrl = "https://example.invalid/app.neutron?private=PRIVATE_PAYLOAD_662";
    await expect(bridge.offerInstall(sensitiveUrl)).rejects.toThrow("install-private-detail");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: "neutron.install.failed",
      context: {
        operation: DiagnosticOperation.Install,
        stage: DiagnosticStage.KernelInstallOffer,
        errorType: "Error",
      },
    });
    expect(JSON.stringify(records)).not.toContain("PRIVATE_PAYLOAD_662");
    expect(JSON.stringify(records)).not.toContain("example.invalid");
    expect(JSON.stringify(records)).not.toContain("install-private-detail");

    records.length = 0;
    const quiet = new VanillaNeutronBridge({
      diagnosticLogger: diagnostics.for("neutron"),
      lifecycleTargets: {},
      resolveIcon: () => undefined,
      api: api(),
    });
    expect(await quiet.loadElements()).toEqual([]);
    await quiet.offerInstall("https://example.invalid/safe.neutron");
    expect(records).toEqual([]);
  });
});
