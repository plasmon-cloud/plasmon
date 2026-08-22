import { test } from "bun:test";
import assert from "node:assert/strict";
import { FS_TOOLS, type FsToolCaller } from "./transport.ts";
import { withFsToolCallAdmission } from "./tool-call-admission.ts";

test("filesystem frontend admission never exceeds the configured concurrent call limit", async () => {
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const delegate: FsToolCaller = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => releases.push(resolve));
    active -= 1;
    return {};
  };
  const call = withFsToolCallAdmission(delegate, 2);

  const first = call(FS_TOOLS.stat, { id: "a" });
  const second = call(FS_TOOLS.list, { parentId: "root" });
  const third = call(FS_TOOLS.revision, {});
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(active, 2);
  assert.equal(peak, 2);
  assert.equal(releases.length, 2, "third call must remain queued until capacity is released");

  releases.shift()?.();
  await first;
  await Promise.resolve();
  assert.equal(active, 2, "queued call should enter when one slot is released");
  assert.equal(peak, 2);

  releases.shift()?.();
  await second;
  releases.shift()?.();
  await third;
  assert.equal(active, 0);
});

test("filesystem frontend admission releases capacity after a rejected call", async () => {
  let calls = 0;
  const call = withFsToolCallAdmission(async () => {
    calls += 1;
    if (calls === 1) throw new Error("expected failure");
    return {};
  }, 1);

  await assert.rejects(call(FS_TOOLS.stat, { id: "a" }), /expected failure/);
  await call(FS_TOOLS.revision, {});
  assert.equal(calls, 2);
});
