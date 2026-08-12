import { describe, expect, test } from "bun:test";
import { ReviewEngine, ReviewEngineError } from "../src/engine.ts";
import { createMemoryReviewPersistence } from "../src/persistence.ts";
import type { ReviewActor } from "../src/model.ts";

const actor: ReviewActor = { key: "human:local", type: "human", displayName: "Brian" };

function fixture() {
  let now = 1_000;
  const counts = { atom: 0, item: 0, comment: 0, revision: 0 };
  const persistence = createMemoryReviewPersistence();
  const engine = new ReviewEngine(persistence, {
    now: () => ++now,
    id: (kind) => `${kind}-${++counts[kind]}`,
  });
  return { engine, persistence };
}

describe("Review semantic transactions", () => {
  test("one semantic coordination command creates exactly one logical revision", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Editor opens" }] });
    const atom = await engine.getAtom(created.atomId);
    const itemId = atom.items[0]!.itemId;
    const result = await engine.apply({
      atomId: created.atomId,
      expectedRevision: created.revisionId,
      commandId: "coord",
      actor,
      operation: {
        type: "review.set_coordination",
        itemId,
        patch: { desired: "must", effort: "small", owner: "Agent 2", workState: "needs_retest" },
      },
    });
    expect(result.sequence).toBe(2);
    const history = await engine.history(created.atomId);
    expect(history).toHaveLength(2);
    expect(history[1]!.revisionId).toBe(result.revisionId);
    const current = await engine.getAtom(created.atomId);
    expect(current.items[0]!.coordination).toMatchObject({ desired: "must", effort: "small", owner: "Agent 2", workState: "needs_retest" });
  });

  test("idempotent command replay does not create a second revision", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Open" }] });
    const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
    const request = {
      atomId: created.atomId,
      expectedRevision: created.revisionId,
      commandId: "result",
      actor,
      operation: { type: "review.set_result", itemId, result: "not_working" as const },
    };
    const first = await engine.apply(request);
    const second = await engine.apply(request);
    expect(second).toEqual({ ...first, replayed: true });
    expect(await engine.history(created.atomId)).toHaveLength(2);
  });

  test("stale same-Atom command is rejected rather than last-write-wins", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Open" }] });
    const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
    await engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "first", actor, operation: { type: "review.set_result", itemId, result: "working" } });
    await expect(engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "stale", actor, operation: { type: "review.set_result", itemId, result: "not_working" } }))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" } satisfies Partial<ReviewEngineError>);
  });

  test("concurrent commands with the same expected revision serialize so only one commits", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Open" }] });
    const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;

    const first = engine.apply({
      atomId: created.atomId,
      expectedRevision: created.revisionId,
      commandId: "concurrent-first",
      actor,
      operation: { type: "review.set_result", itemId, result: "working" },
    });
    const second = engine.apply({
      atomId: created.atomId,
      expectedRevision: created.revisionId,
      commandId: "concurrent-second",
      actor,
      operation: { type: "review.set_result", itemId, result: "not_working" },
    });

    const settled = await Promise.allSettled([first, second]);
    const fulfilled = settled.filter((result): result is PromiseFulfilledResult<Awaited<typeof first>> => result.status === "fulfilled");
    const rejected = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: "REVISION_CONFLICT" } satisfies Partial<ReviewEngineError>);

    const committed = fulfilled[0]!.value;
    expect(committed.sequence).toBe(2);
    const current = await engine.getAtom(created.atomId);
    expect(current.meta.currentRevision).toBe(committed.revisionId);
    expect(current.meta.currentSequence).toBe(2);
    expect(await engine.history(created.atomId)).toHaveLength(2);
  });

  test("coordination changes never rewrite independent human evidence", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Open" }] });
    const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
    const evidence = await engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "evidence", actor, operation: { type: "review.set_result", itemId, result: "not_working", note: "focus wrong" } });
    await engine.apply({ atomId: created.atomId, expectedRevision: evidence.revisionId, commandId: "coord", actor: { key: "agent:2", type: "ai", displayName: "Agent 2" }, operation: { type: "review.set_coordination", itemId, patch: { workState: "done", desired: "must" } } });
    const item = (await engine.getAtom(created.atomId)).items[0]!;
    expect(item.results[actor.key]).toMatchObject({ result: "not_working", note: "focus wrong" });
    expect(item.coordination).toMatchObject({ workState: "done", desired: "must" });
  });

  test("small-field mutation persists one changed item rather than replacing whole Atom", async () => {
    const { engine, persistence } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Large", actor, items: Array.from({ length: 100 }, (_, i) => ({ title: `Item ${i}` })) });
    const before = persistence.stats();
    const itemId = (await engine.getAtom(created.atomId)).items[50]!.itemId;
    await engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "single", actor, operation: { type: "review.set_result", itemId, result: "working" } });
    const after = persistence.stats();
    expect(after.itemWrites - before.itemWrites).toBe(1);
    expect(after.replacements - before.replacements).toBe(0);
    expect(after.commits - before.commits).toBe(1);
  });
});

describe("Review logical identity and restore", () => {
  test("one provider owns multiple logical Atoms", async () => {
    const { engine } = fixture();
    const a = await engine.createAtom({ commandId: "a", title: "A", actor });
    const b = await engine.createAtom({ commandId: "b", title: "B", actor });
    expect(a.atomId).not.toBe(b.atomId);
    expect((await engine.listAtoms()).map((entry) => entry.atomId).sort()).toEqual([a.atomId, b.atomId].sort());
  });

  test("whole-Atom restore creates a new revision on the same Atom and preserves history", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor, items: [{ title: "Open" }] });
    const itemId = (await engine.getAtom(created.atomId)).items[0]!.itemId;
    const good = await engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "good", actor, operation: { type: "review.set_result", itemId, result: "working" } });
    const bad = await engine.apply({ atomId: created.atomId, expectedRevision: good.revisionId, commandId: "bad", actor, operation: { type: "review.set_result", itemId, result: "not_working" } });
    const restored = await engine.apply({ atomId: created.atomId, expectedRevision: bad.revisionId, commandId: "restore", actor, operation: { type: "history.restore", revisionId: good.revisionId } });
    expect(restored.atomId).toBe(created.atomId);
    expect(restored.revisionId).not.toBe(good.revisionId);
    expect(restored.sequence).toBe(4);
    expect((await engine.getAtom(created.atomId)).items[0]!.results[actor.key]!.result).toBe("working");
    expect((await engine.history(created.atomId)).map((entry) => entry.revisionId)).toEqual([created.revisionId, good.revisionId, bad.revisionId, restored.revisionId]);
    expect((await engine.getRevision(created.atomId, bad.revisionId)).items[0]!.results[actor.key]!.result).toBe("not_working");
  });

  test("generated item identity is journaled and reconstructs deterministically", async () => {
    const { engine } = fixture();
    const created = await engine.createAtom({ commandId: "create", title: "Gate", actor });
    const added = await engine.apply({ atomId: created.atomId, expectedRevision: created.revisionId, commandId: "add", actor, operation: { type: "review.create_item", title: "Stable item" } });
    const current = await engine.getAtom(created.atomId);
    const historical = await engine.getRevision(created.atomId, added.revisionId);
    expect(historical.items[0]!.itemId).toBe(current.items[0]!.itemId);
  });
});
