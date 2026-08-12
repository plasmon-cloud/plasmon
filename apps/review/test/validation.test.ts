import { expect, test } from "bun:test";
import { ReviewEngine } from "../src/engine.ts";
import type { ReviewOperation } from "../src/model.ts";
import { createMemoryReviewPersistence } from "../src/persistence.ts";

const actor = { key: "human:local", type: "human" as const };

function fixture() {
  let sequence = 0;
  const engine = new ReviewEngine(createMemoryReviewPersistence(), {
    now: () => ++sequence,
    id: (kind) => `${kind}-${++sequence}`,
  });
  return engine;
}

test("semantic engine rejects invalid Review-domain enum values without relying on tool schema", async () => {
  const engine = fixture();
  const created = await engine.createAtom({ commandId: "create", title: "Validation", actor, items: [{ title: "Item" }] });
  const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
  const invalid = {
    type: "review.set_coordination",
    itemId,
    patch: { workState: "invented_state" },
  } as unknown as ReviewOperation;

  await expect(engine.apply({
    atomId: created.atomId,
    expectedRevision: created.revisionId,
    commandId: "invalid",
    actor,
    operation: invalid,
  })).rejects.toMatchObject({ code: "INVALID_OPERATION" });

  expect((await engine.history(created.atomId))).toHaveLength(1);
});

test("semantic engine rejects unknown test-result values without writing a revision", async () => {
  const engine = fixture();
  const created = await engine.createAtom({ commandId: "create", title: "Validation", actor, items: [{ title: "Item" }] });
  const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
  const invalid = {
    type: "review.set_result",
    itemId,
    result: "maybe",
  } as unknown as ReviewOperation;

  await expect(engine.apply({
    atomId: created.atomId,
    expectedRevision: created.revisionId,
    commandId: "invalid-result",
    actor,
    operation: invalid,
  })).rejects.toMatchObject({ code: "INVALID_OPERATION" });

  expect((await engine.history(created.atomId))).toHaveLength(1);
});
