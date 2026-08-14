import { expect, test } from "bun:test";
import type { FileOperationSnapshot } from "./operation-state.ts";
import { presentFileOperation } from "./operation-presentation.ts";

function snapshot(overrides: Partial<FileOperationSnapshot>): FileOperationSnapshot {
  return {
    status: "idle",
    kind: null,
    totalItems: 0,
    processedItems: 0,
    succeededItems: 0,
    failedItems: 0,
    currentIndex: null,
    currentItem: null,
    failures: [],
    ...overrides,
  };
}

test("presents only truthful running operation state", () => {
  expect(presentFileOperation(snapshot({}))).toEqual({ running: false, message: null });

  expect(presentFileOperation(snapshot({
    status: "running",
    kind: "paste",
    totalItems: 2,
  }))).toEqual({ running: true, message: "Pasting 2 items…" });

  expect(presentFileOperation(snapshot({
    status: "running",
    kind: "import",
    totalItems: 3,
    currentIndex: 2,
    currentItem: "notes.md",
  }))).toEqual({ running: true, message: "Importing 2 of 3: notes.md" });

  expect(presentFileOperation(snapshot({
    status: "running",
    kind: "move",
    totalItems: 2,
    currentIndex: 1,
    currentItem: "draft.txt",
  }))).toEqual({ running: true, message: "Moving 1 of 2: draft.txt" });
});
