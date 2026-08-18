import { expect, test } from "bun:test";
import { createMemoryReviewSubmissionStore } from "../src/submission.ts";

test("submission bookkeeping survives later reads without changing Review semantics", async () => {
  const store = createMemoryReviewSubmissionStore();
  expect(await store.load("atom-1")).toBeNull();

  await store.save({
    atomId: "atom-1",
    path: "/review-submission.md",
    revisionId: "revision-7",
    etag: "a".repeat(64),
    submittedAt: 123,
  });

  expect(await store.load("atom-1")).toEqual({
    atomId: "atom-1",
    path: "/review-submission.md",
    revisionId: "revision-7",
    etag: "a".repeat(64),
    submittedAt: 123,
  });
});

test("saving a newer submission replaces only the operational submission record", async () => {
  const store = createMemoryReviewSubmissionStore();
  await store.save({ atomId: "atom-1", path: "/review-submission.md", revisionId: "revision-7", etag: "a".repeat(64), submittedAt: 123 });
  await store.save({ atomId: "atom-1", path: "/review-submission.md", revisionId: "revision-9", etag: "b".repeat(64), submittedAt: 456 });

  expect(await store.load("atom-1")).toEqual({
    atomId: "atom-1",
    path: "/review-submission.md",
    revisionId: "revision-9",
    etag: "b".repeat(64),
    submittedAt: 456,
  });
});
