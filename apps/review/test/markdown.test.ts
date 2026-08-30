import { expect, test } from "bun:test";
import { ReviewEngine } from "../src/engine.ts";
import { exportReviewMarkdown, parseReviewMarkdown, sourceImport } from "../src/markdown.ts";
import { createMemoryReviewPersistence } from "../src/persistence.ts";

const actor = { key: "human:local", type: "human" as const, displayName: "Local reviewer" };

test("acceptance-plan import preserves indented human test instructions", async () => {
  const parsed = parseReviewMarkdown([
    "# Release Gate",
    "",
    "- [ ] Back returns to the prior folder",
    "  Steps:",
    "    1. Open Documents.",
    "    2. Open a child folder.",
    "    3. Press Back.",
    "  Expected: Documents is shown again.",
    "- [x] Markdown opens in Markdown",
    "  Expected: demo.md opens in the Markdown app.",
    "",
  ].join("\n"));

  expect(parsed).toEqual({
    title: "Release Gate",
    items: [
      {
        title: "Back returns to the prior folder",
        descriptionMarkdown: "Steps:\n1. Open Documents.\n2. Open a child folder.\n3. Press Back.\nExpected: Documents is shown again.",
      },
      {
        title: "Markdown opens in Markdown",
        descriptionMarkdown: "Expected: demo.md opens in the Markdown app.",
      },
    ],
  });

  const engine = new ReviewEngine(createMemoryReviewPersistence(), {
    now: () => 10,
    id: (() => { let n = 0; return (kind) => `${kind}-${++n}`; })(),
  });
  const created = await engine.createAtom({
    commandId: "import",
    title: parsed.title!,
    actor,
    source: sourceImport("/review-plan.md", "text/markdown", 10, "abc"),
    items: parsed.items,
  });
  const atom = await engine.getAtom(created.atomId);
  expect(atom.meta.source?.path).toBe("/review-plan.md");
  expect(atom.items[0]!.descriptionMarkdown).toContain("Press Back");
  expect(Object.keys(atom.items[0]!.results)).toHaveLength(0);
});

test("submitted Markdown carries independent human results and failure evidence", async () => {
  const persistence = createMemoryReviewPersistence();
  let n = 0;
  const engine = new ReviewEngine(persistence, { now: () => ++n, id: (kind) => `${kind}-${++n}` });
  const created = await engine.createAtom({
    commandId: "create",
    title: "acceptance review",
    actor,
    items: [{ title: "Explorer Back works", descriptionMarkdown: "Open Documents, enter Games, press Back.\nExpected: Documents is restored." }],
  });
  const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;

  const first = await engine.apply({
    atomId: created.atomId,
    expectedRevision: created.revisionId,
    commandId: "result-local",
    actor,
    operation: {
      type: "review.set_result",
      itemId,
      result: "not_working",
      note: "Back jumped to the desktop instead of Documents.",
    },
  });

  await engine.apply({
    atomId: created.atomId,
    expectedRevision: first.revisionId,
    commandId: "result-second-human",
    actor: { key: "human:reviewer-2", type: "human", displayName: "Second reviewer" },
    operation: {
      type: "review.set_result",
      itemId,
      result: "working",
      note: "Passed from a fresh session.",
    },
  });

  const output = exportReviewMarkdown(await engine.getAtom(created.atomId));
  expect(output).toContain("# acceptance review");
  expect(output).toContain("- [ ] Explorer Back works");
  expect(output).toContain("How to test / expected behavior");
  expect(output).toContain("Review status: mixed");
  expect(output).toContain("human:local: FAIL");
  expect(output).toContain("human:reviewer-2: PASS");
  expect(output).toContain("Back jumped to the desktop instead of Documents.");
  expect(output).toContain("Passed from a fresh session.");
  expect(output).not.toContain("Desired:");
  expect(output).not.toContain("Effort:");
  expect(output).not.toContain("Owner:");
});
