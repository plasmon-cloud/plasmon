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

test("move state exposes truthful item progress and partial failure", () => {
  const state = new FileOperationState();
  expect(state.begin("move", 3)).toBe(true);
  state.startItem(1, "one.txt");
  expect(state.snapshot()).toMatchObject({
    kind: "move",
    status: "running",
    totalItems: 3,
    processedItems: 0,
    currentIndex: 1,
    currentItem: "one.txt",
  });
  state.succeedItem();
  state.startItem(2, "two.txt");
  state.failItem("two.txt", "expected move failure");
  state.complete();
  expect(state.snapshot()).toMatchObject({
    kind: "move",
    status: "failed",
    totalItems: 3,
    processedItems: 2,
    succeededItems: 1,
    failedItems: 1,
    currentIndex: null,
    currentItem: null,
    failures: [{ item: "two.txt", message: "expected move failure" }],
  });
});

test("operation state rejects a second start while active", () => {
  const state = new FileOperationState();
  expect(state.begin("paste", 3)).toBe(true);
  expect(state.begin("import", 1)).toBe(false);
  expect(state.begin("move", 2)).toBe(false);
});
