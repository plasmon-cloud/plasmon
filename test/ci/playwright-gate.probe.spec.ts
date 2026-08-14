import { expect, test } from "@playwright/test";

const mode = process.env.PLAYWRIGHT_GATE_PROBE_MODE;

test("Playwright release gate probe", ({}, testInfo) => {
  switch (mode) {
    case "pass":
      expect(true).toBe(true);
      return;
    case "flaky":
      // Deliberately fail the initial attempt and pass the configured retry.
      expect(testInfo.retry).toBeGreaterThan(0);
      return;
    case "fail":
      expect(false).toBe(true);
      return;
    default:
      throw new Error(`Unknown PLAYWRIGHT_GATE_PROBE_MODE: ${String(mode)}`);
  }
});
