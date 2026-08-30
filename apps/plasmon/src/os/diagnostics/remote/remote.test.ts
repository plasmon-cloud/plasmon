import { describe, expect, test } from "bun:test";
import type { DiagnosticRecord } from "../service.ts";
import { attachRemoteIncidentSink } from "./bridge.ts";
import {
  createRemoteFaultFingerprint,
  createRemoteIncident,
  type RemoteEnvelopePolicy,
} from "./envelope.ts";
import {
  hardenRollbarPayloadForRemoteIncident,
  RollbarRemoteIncidentSink,
} from "./rollbar.ts";
import type { RemoteBuildIdentity, RemoteIncident, RemoteIncidentSink } from "./types.ts";

const BUILD: RemoteBuildIdentity = {
  plasmonVersion: "0.1.0",
  releaseSha: "0123456789abcdef0123456789abcdef01234567",
  packageProfile: "full",
  packageIdentity: "plasmon",
};

const POLICY: RemoteEnvelopePolicy = {
  build: BUILD,
  metadataAllowlist: ["runtime", "phase", "password", "path", "nested"],
};

function errorRecord(overrides: Partial<DiagnosticRecord> = {}): DiagnosticRecord {
  return {
    timestamp: 1_700_000_000_000,
    level: "error",
    subsystem: "runtime",
    event: "runtime.synthetic.failed",
    message: "Synthetic failure at /home/alice/Documents/private.txt?token=raw-secret",
    correlationId: "corr-42",
    context: {
      runtime: "monaco",
      phase: "startup",
      password: "never-send-me",
      path: "/home/alice/Documents/private.txt",
      nested: { document: "private document contents" },
      unapproved: "must not cross the boundary",
    },
    error: {
      name: "SyntheticError",
      message: "Bearer abc.def.ghi failed at /Users/alice/private.txt",
      stack: "SyntheticError: failed\n    at explode (https://plasmon.example/main.js?token=secret:10:20)",
    },
    ...overrides,
  };
}

class TestDiagnostics {
  private readonly listeners = new Set<(record: DiagnosticRecord) => void>();
  publish(record: DiagnosticRecord): void {
    for (const listener of this.listeners) {
      try { listener(record); } catch { /* observer failures are isolated */ }
    }
  }
  subscribe(listener: (record: DiagnosticRecord) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

describe("remote incident envelope", () => {
  test("is allowlisted, bounded, sanitized, correlation-aware, and does not retain raw objects", () => {
    const incident = createRemoteIncident(errorRecord(), [], POLICY);
    expect(incident).toBeDefined();
    const serialized = JSON.stringify(incident);
    expect(serialized).toContain('"runtime":"monaco"');
    expect(serialized).toContain('"phase":"startup"');
    expect(serialized).not.toContain("never-send-me");
    expect(serialized).not.toContain("private document contents");
    expect(serialized).not.toContain("must not cross the boundary");
    expect(serialized).not.toContain("abc.def.ghi");
    expect(serialized).not.toContain("/home/alice");
    expect(serialized).not.toContain("/Users/alice");
    expect(incident?.metadata?.path).toBe("[PATH]");
    expect(incident?.metadata).not.toHaveProperty("nested");
    expect(incident?.correlationId).toBe("corr-42");
    expect(incident?.faultFingerprint).toMatch(/^plasmon:v1:[0-9a-f]{16}$/);
  });

  test("fingerprints repeat the same defect and separate materially different events", () => {
    const first = createRemoteFaultFingerprint(errorRecord());
    const repeated = createRemoteFaultFingerprint(errorRecord({
      timestamp: 1_700_000_100_000,
      correlationId: "different-occurrence-correlation",
    }));
    const different = createRemoteFaultFingerprint(errorRecord({ event: "runtime.synthetic.other-failed" }));
    expect(repeated).toBe(first);
    expect(different).not.toBe(first);
  });
});

describe("remote incident bridge", () => {
  test("uses lower-level diagnostics as bounded breadcrumbs and coalesces repeated storms", async () => {
    const diagnostics = new TestDiagnostics();
    const reports: RemoteIncident[] = [];
    const sink: RemoteIncidentSink = { report: (incident) => { reports.push(incident); } };
    let now = 1_000;
    const bridge = attachRemoteIncidentSink(diagnostics, sink, {
      ...POLICY,
      breadcrumbLimit: 2,
      repeatIntervalMs: 10_000,
      now: () => now,
    });

    diagnostics.publish({ ...errorRecord(), level: "info", event: "runtime.prepare", error: undefined });
    diagnostics.publish({ ...errorRecord(), level: "warn", event: "runtime.degraded", error: undefined });
    diagnostics.publish({ ...errorRecord(), level: "info", event: "runtime.ready", error: undefined });
    diagnostics.publish(errorRecord());
    for (let index = 0; index < 500; index += 1) diagnostics.publish(errorRecord({ timestamp: 2_000 + index }));
    await bridge.flush();

    expect(reports).toHaveLength(1);
    expect(reports[0]?.breadcrumbs.map((entry) => entry.event)).toEqual(["runtime.degraded", "runtime.ready"]);
    expect(reports[0]?.breadcrumbs[0]?.correlationId).toBe("corr-42");
    expect(bridge.suppressedReports).toBe(500);

    now += 10_001;
    diagnostics.publish(errorRecord({ timestamp: 9_999 }));
    await bridge.flush();
    expect(reports).toHaveLength(2);
    expect(reports[1]?.metadata?.coalescedOccurrences).toBe(500);
    bridge.close();
  });

  test("isolates rejected remote sends and bounds the pending queue", async () => {
    const diagnostics = new TestDiagnostics();
    const errors: unknown[] = [];
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const sink: RemoteIncidentSink = {
      async report() {
        calls += 1;
        if (calls === 1) await blocked;
        else throw new Error("remote unavailable");
      },
    };
    const bridge = attachRemoteIncidentSink(diagnostics, sink, {
      ...POLICY,
      maxPendingReports: 2,
      repeatIntervalMs: 0,
      onSinkError: (error) => errors.push(error),
    });

    diagnostics.publish(errorRecord({ event: "failure.1" }));
    diagnostics.publish(errorRecord({ event: "failure.2" }));
    diagnostics.publish(errorRecord({ event: "failure.3" }));
    diagnostics.publish(errorRecord({ event: "failure.4" }));
    expect(bridge.droppedReports).toBe(1);
    release?.();
    await bridge.flush();
    expect(errors.length).toBeGreaterThan(0);
    bridge.close();
  });
});

describe("Rollbar adapter", () => {
  test("disables automatic authorities and transports only the remote envelope", async () => {
    let configuration: Record<string, unknown> | undefined;
    let sent: unknown[] | undefined;
    const client = {
      captureEvent() {},
      error(...args: unknown[]) {
        sent = args;
        const callback = args.at(-1) as ((error?: unknown) => void);
        callback();
      },
      critical(...args: unknown[]) {
        this.error(...args);
      },
      wait(callback: () => void) { callback(); },
    };
    const sink = new RollbarRemoteIncidentSink({
      accessToken: "client-token",
      environment: "experiment",
      releaseSha: BUILD.releaseSha,
      createClient: (options) => {
        configuration = options as Record<string, unknown>;
        return client;
      },
    });
    const incident = createRemoteIncident(errorRecord(), [], POLICY);
    if (!incident) throw new Error("expected test incident");
    await sink.report(incident);

    expect(configuration?.captureUncaught).toBe(false);
    expect(configuration?.captureUnhandledRejections).toBe(false);
    expect(configuration?.wrapGlobalEventHandlers).toBe(false);
    expect(configuration?.autoInstrument).toBe(false);
    expect(configuration?.captureIp).toBe(false);
    expect(configuration?.sendConfig).toBe(false);
    expect(sent?.[0]).toBeInstanceOf(Error);
    const sentJson = JSON.stringify(sent?.[1]);
    expect(sentJson).toContain('"correlationId":"corr-42"');
    expect(sentJson).not.toContain("unapproved");
    expect(sentJson).not.toContain("never-send-me");
  });

  test("final payload hardening removes ambient browser/request identity", () => {
    const payload: Record<string, unknown> = {
      request: { url: "https://plasmon.example/private?token=secret", headers: { Cookie: "bad" } },
      person: { id: "user" },
      server: { host: "private-host" },
      context: "/Documents/secret.txt",
      trace: { extra: "ambient" },
      client: { javascript: { browser: "Full UA", screen: { width: 100 } } },
      custom: { plasmon: { faultFingerprint: "plasmon:v1:0123456789abcdef" } },
    };
    hardenRollbarPayloadForRemoteIncident(payload, BUILD.releaseSha, true);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("Cookie");
    expect(serialized).not.toContain("private-host");
    expect(serialized).not.toContain("Full UA");
    expect(serialized).not.toContain("secret.txt");
    expect(payload.fingerprint).toBe("plasmon:v1:0123456789abcdef");
    expect(payload.client).toEqual({
      javascript: { code_version: BUILD.releaseSha, source_map_enabled: true },
    });
  });
});
