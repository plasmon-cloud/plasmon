import { describe, expect, test } from "bun:test";
import { draftAfterReviewAction, settleReviewAction } from "../src/action_outcome.ts";

describe("Review action outcomes", () => {
  test("reports accepted actions without inventing an error", async () => {
    expect(await settleReviewAction(async () => {})).toEqual({ ok: true });
  });

  test("converts a rejected provider action into an explicit failed outcome", async () => {
    expect(await settleReviewAction(async () => {
      throw new Error("provider rejected update");
    })).toEqual({ ok: false, error: "provider rejected update" });
  });

  test("keeps submitted drafts after failure and only clears the accepted draft", () => {
    expect(draftAfterReviewAction("Needs evidence", "Needs evidence", false)).toBe("Needs evidence");
    expect(draftAfterReviewAction("Needs evidence", "Needs evidence", true)).toBe("");
    expect(draftAfterReviewAction("Needs newer evidence", "Needs evidence", true)).toBe("Needs newer evidence");
  });
});
