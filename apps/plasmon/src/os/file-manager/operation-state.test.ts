import { expect, test } from "bun:test";
import { FileOperationState } from "./operation-state.ts";

test("operation state tracks success", () => {
  const state = new FileOperationState();
  expect(state.begin("import", 2)).toBe(true);
  state.startItem(1, "one");
  state.succeedItem();
  state.startItem(2, "two");
  state.succeedItem();
  state.complete();
  expect(state.snapshot().status).toBe("completed");
  expect(state.snapshot().processedItems).toBe(2);
});

test("operation state preserves a mixed result", () => {
  const state = new FileOperationState();
  state.begin("import", 2);
  state.startItem(1, "one");
  state.succeedItem();
  state.startItem(2, "two");
  state.failItem("two", "expected test error");
  state.complete();
  expect(state.snapshot().status).toBe("failed");
  expect(state.snapshot().succeededItems).toBe(1);
  expect(state.snapshot().failedItems).toBe(1);
});

test("operation state rejects a second start while active", () => {
  const state = new FileOperationState();
  expect(state.begin("paste", 3)).toBe(true);
  expect(state.begin("import", 1)).toBe(false);
});
