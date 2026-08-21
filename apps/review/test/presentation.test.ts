import { describe, expect, test } from "bun:test";
import { createEmptyItem } from "../src/model.ts";
import {
  DESIRED_OPTIONS,
  EFFORT_OPTIONS,
  WORK_STATE_OPTIONS,
  createReviewDetailsDraft,
  formatReviewTime,
  hasUnsavedReviewDetails,
} from "../src/presentation.ts";

describe("Review first-demo presentation vocabulary", () => {
  test("explains structured planning values in user-facing language", () => {
    expect(DESIRED_OPTIONS.find((option) => option.value === "must")?.description).toContain("Required");
    expect(EFFORT_OPTIONS.find((option) => option.value === "small")?.description).toContain("bounded");
    expect(WORK_STATE_OPTIONS.find((option) => option.value === "needs_retest")?.label).toBe("Needs retest");
  });

  test("detects staged item details without changing Review semantics", () => {
    const item = createEmptyItem("item-1", "Demo readiness");
    const draft = createReviewDetailsDraft(item);
    expect(hasUnsavedReviewDetails(item, draft)).toBe(false);

    expect(hasUnsavedReviewDetails(item, { ...draft, desired: "must" })).toBe(true);
    expect(hasUnsavedReviewDetails(item, { ...draft, owner: "Agent 13" })).toBe(true);
    expect(hasUnsavedReviewDetails(item, { ...draft, owner: "   " })).toBe(false);
  });

  test("formats revision activity consistently", () => {
    expect(formatReviewTime(Date.UTC(2026, 7, 13, 3, 45), { locale: "en-US", timeZone: "UTC" })).toBe("Aug 13, 3:45 AM");
  });
});
