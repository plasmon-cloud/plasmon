import { describe, expect, test } from "bun:test";
import {
  BrowserHealthLedger,
  type BrowserHealthIssue,
} from "../../../test/e2e/plasmon-browser-health.ts";
import {
  PackagedDiagnosticTail,
  sanitizePackagedDiagnosticLine,
} from "../../../test/e2e/plasmon-diagnostic-artifact.ts";

const issue = (overrides: Partial<BrowserHealthIssue> = {}): BrowserHealthIssue => ({
  kind: "console.warn",
  message: "unexpected warning",
  url: "http://plasmon.test/app/plasmon/index.html",
  ...overrides,
});

describe("shared packaged browser health policy", () => {
  test("unexpected browser/runtime warnings and errors are fatal by default", () => {
    for (const candidate of [
      issue(),
      issue({ kind: "console.error", message: "unexpected console error" }),
      issue({ kind: "pageerror", message: "uncaught exception" }),
      issue({ kind: "requestfailed", message: "net::ERR_FAILED", url: "http://plasmon.test/app/plasmon/main.js" }),
      issue({ kind: "response", message: "HTTP 404", url: "http://plasmon.test/app/plasmon/missing.js", status: 404 }),
    ]) {
      const ledger = new BrowserHealthLedger();
      ledger.record(candidate);
      expect(() => ledger.assertClean()).toThrow(candidate.kind);
    }
  });

  test("an explicit narrow allow rule suppresses only the named issue and preserves audit evidence", () => {
    const ledger = new BrowserHealthLedger({
      allow: [
        {
          kind: "pageerror",
          message: "Canceled",
          reason: "Monaco cancellation token during the active editor lifecycle",
        },
      ],
    });

    ledger.record(issue({ kind: "pageerror", message: "Canceled" }));
    ledger.assertClean();
    expect(ledger.allowedIssues()).toEqual([
      expect.objectContaining({
        kind: "pageerror",
        message: "Canceled",
        reason: "Monaco cancellation token during the active editor lifecycle",
      }),
    ]);

    ledger.record(issue({ kind: "pageerror", message: "Different failure" }));
    expect(() => ledger.assertClean()).toThrow("Different failure");
  });

  test("diagnostic failure artifacts retain only bounded stable identity", () => {
    const sensitive = "2026-08-30T18:00:00.000Z | ERROR | [process] | process.start.failed | "
      + "Bearer secret-token /Users/private/document.txt https://private.example/path?token=secret";
    expect(sanitizePackagedDiagnosticLine(sensitive)).toBe(
      "2026-08-30T18:00:00.000Z | ERROR | [process] | process.start.failed",
    );
    expect(sanitizePackagedDiagnosticLine("ordinary console https://private.example/path")).toBeNull();

    const tail = new PackagedDiagnosticTail();
    for (let index = 0; index < 60; index += 1) {
      tail.record(
        `2026-08-30T18:00:${String(index % 60).padStart(2, "0")}.000Z | WARN | [filesystem] | file.operation.failed | private-${index}`,
      );
    }
    const artifact = tail.text();
    expect(artifact.trimEnd().split("\n")).toHaveLength(40);
    expect(new TextEncoder().encode(artifact).byteLength).toBeLessThanOrEqual(8 * 1024);
    expect(artifact).not.toContain("private-");
  });

  test("capturing a diagnostic console line does not allowlist it from BrowserHealth", () => {
    const message = "2026-08-30T18:00:00.000Z | ERROR | [process] | process.start.failed | launch failed";
    const tail = new PackagedDiagnosticTail();
    tail.record(message);
    expect(tail.text()).toContain("[process] | process.start.failed");

    const ledger = new BrowserHealthLedger();
    ledger.record(issue({ kind: "console.error", message }));
    expect(() => ledger.assertClean()).toThrow("console.error");
  });
});
