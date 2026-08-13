import { describe, expect, test } from "bun:test";
import {
  BrowserHealthLedger,
  type BrowserHealthIssue,
} from "../../../test/e2e/plasmon-browser-health.ts";

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
});
