import { expect, test } from "bun:test";
import { waitForJsDosSave } from "./save-lifecycle.ts";

test("close completes only after an explicit successful save", async () => {
  expect(await waitForJsDosSave(async () => true, 1_000)).toBe("complete");
});

test("unsuccessful save preserves the pending close", async () => {
  expect(await waitForJsDosSave(async () => false, 1_000)).toBe("failed");
});

test("rejected save preserves the pending close", async () => {
  expect(await waitForJsDosSave(async () => {
    throw new Error("filesystem write failed");
  }, 1_000)).toBe("failed");
});
