import { expect, test } from "bun:test";
import { ReviewEngine } from "../src/engine.ts";
import { exportReviewMarkdown, parseReviewMarkdown, sourceImport } from "../src/markdown.ts";
import { createMemoryReviewPersistence } from "../src/persistence.ts";

const actor = { key: "human:local", type: "human" as const, displayName: "Local reviewer" };

test("Markdown/TODO import ignores checkbox completion as participant evidence", async () => {
  const parsed = parseReviewMarkdown("# Release Gate\n\n- [x] Opens editor\n- [ ] Downloads work\n");
  expect(parsed).toEqual({ title: "Release Gate", items: [{ title: "Opens editor" }, { title: "Downloads work" }] });
  const engine = new ReviewEngine(createMemoryReviewPersistence(), {
    now: () => 10,
    id: (() => { let n = 0; return (kind) => `${kind}-${++n}`; })(),
  });
  const created = await engine.createAtom({ commandId: "import", title: parsed.title!, actor, source: sourceImport("/todo.md", "text/markdown", 10, "abc"), items: parsed.items });
  const atom = await engine.getAtom(created.atomId);
  expect(atom.meta.source?.path).toBe("/todo.md");
  expect(atom.meta.atomId).not.toBe("/todo.md");
  expect(Object.keys(atom.items[0]!.results)).toHaveLength(0);
});

test("Markdown export is readable and re-imports only top-level Review items", async () => {
  const persistence = createMemoryReviewPersistence();
  let n = 0;
  const engine = new ReviewEngine(persistence, { now: () => ++n, id: (kind) => `${kind}-${++n}` });
  const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Editor opens" }] });
  const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
  const result = await engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "result", actor, operation: { type: "review.set_result", itemId, result: "needs_polish" } });
  await engine.apply({ atomId: created.atomId, expectedRevision: result.revisionId, commandId: "coord", actor, operation: { type: "review.set_coordination", itemId, patch: { desired: "must", effort: "small", owner: "Agent 2", workState: "needs_retest" } } });
  const output = exportReviewMarkdown(await engine.getAtom(created.atomId));
  expect(output).toContain("# Gate");
  expect(output).toContain("- [ ] Editor opens");
  expect(output).toContain("Desired: must");
  expect(output).toContain("Owner: Agent 2");
  expect(output).toContain("1 needs polish");
  expect(parseReviewMarkdown(output)).toEqual({ title: "Gate", items: [{ title: "Editor opens" }] });
});
