import { test } from "bun:test";
import assert from "node:assert/strict";
import { createFrontendCallAdmission } from "./frontend-call-admission.ts";

test("frontend admission never exceeds the configured caller-endpoint limit", async () => {
  const admit = createFrontendCallAdmission(2);
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];

  const operation = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => releases.push(resolve));
    active -= 1;
  };

  const first = admit("plasmon.fs.stat", operation);
  const second = admit("kernel:endpoints.list", operation);
  const third = admit("plasmon.fs.list", operation);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(active, 2);
  assert.equal(peak, 2);
  assert.equal(releases.length, 2, "third call must remain queued until capacity is released");

  releases.shift()?.();
  await first;
  await Promise.resolve();
  assert.equal(active, 2, "queued call should occupy the released endpoint slot");
  assert.equal(peak, 2);

  releases.shift()?.();
  await second;
  releases.shift()?.();
  await third;
  assert.equal(active, 0);
});

test("frontend admission releases capacity after a rejected call", async () => {
  const admit = createFrontendCallAdmission(1);
  let calls = 0;

  await assert.rejects(
    admit("plasmon.fs.stat", async () => {
      calls += 1;
      throw new Error("expected failure");
    }),
    /expected failure/,
  );

  await admit("kernel:endpoints.list", async () => {
    calls += 1;
  });
  assert.equal(calls, 2);
});

test("a released slot is reserved for the oldest queued call before a newcomer can barge", async () => {
  const admit = createFrontendCallAdmission(1);
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  let releaseSecond: (() => void) | undefined;

  const first = admit("first", async () => {
    order.push("first");
    await new Promise<void>((resolve) => { releaseFirst = resolve; });
  });
  const second = admit("second", async () => {
    order.push("second");
    await new Promise<void>((resolve) => { releaseSecond = resolve; });
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ["first"]);

  releaseFirst?.();
  const third = admit("third", async () => {
    order.push("third");
  });
  await first;
  await Promise.resolve();
  assert.deepEqual(order, ["first", "second"], "queued caller owns the released slot before third arrives");

  releaseSecond?.();
  await second;
  await third;
  assert.deepEqual(order, ["first", "second", "third"]);
});
