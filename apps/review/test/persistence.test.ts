import { expect, test } from "bun:test";
import { ReviewEngine } from "../src/engine.ts";
import { createMemoryReviewPersistence } from "../src/persistence.ts";

test("provider state survives engine restart while Atom and Revision identity remain logical", async () => {
  const persistence = createMemoryReviewPersistence();
  let n = 0;
  const options = { now: () => ++n, id: (kind: "atom" | "item" | "comment" | "revision") => `${kind}-${++n}` };
  const first = new ReviewEngine(persistence, options);
  const created = await first.createAtom({ commandId: "create", title: "Persistent Review", actor: { key: "human:local", type: "human" } });
  const revisionBeforeRestart = created.revisionId;

  const reopened = new ReviewEngine(persistence, options);
  const atom = await reopened.getAtom(created.atomId);
  expect(atom.meta.atomId).toBe(created.atomId);
  expect(atom.meta.currentRevision).toBe(revisionBeforeRestart);
  expect((await reopened.listAtoms())[0]!.atomId).toBe(created.atomId);
});
