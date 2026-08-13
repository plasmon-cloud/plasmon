import { expect, test } from "bun:test";
import { jsDosRuntimeDefinition } from "../../../src/native-apps/jsdos/index.ts";

/** #64 deterministic RED: current host intentionally exposes no durable save bridge. */
test("#64 js-dos runtime contract exposes a Plasmon-authoritative progress bridge", () => {
  const runtime = jsDosRuntimeDefinition as typeof jsDosRuntimeDefinition & {
    saveProgress?: unknown;
    restoreProgress?: unknown;
  };
  expect(typeof runtime.saveProgress).toBe("function");
  expect(typeof runtime.restoreProgress).toBe("function");
});
