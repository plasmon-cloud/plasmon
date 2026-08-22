import { expect, test } from "bun:test";
import { SerializedRefreshQueue } from "./serialized-refresh-queue.ts";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test("#371 refresh request during an active pass forces a serialized follow-up", async () => {
  const queue = new SerializedRefreshQueue();
  const firstPass = deferred();
  let passes = 0;

  const first = queue.request(async () => {
    passes += 1;
    await firstPass.promise;
  });

  await Promise.resolve();
  expect(passes).toBe(1);

  const second = queue.request(async () => {
    passes += 1;
  });

  firstPass.resolve();
  await Promise.all([first, second]);

  expect(passes).toBe(2);
});

test("#371 refresh requests cannot be lost while the active runner settles", async () => {
  const queue = new SerializedRefreshQueue();
  const firstPass = deferred();
  let passes = 0;

  const first = queue.request(async () => {
    passes += 1;
    await firstPass.promise;
  });

  await Promise.resolve();
  firstPass.resolve();

  // Deliberately request again immediately after releasing the first pass.
  // The first runner can now be between its final loop check and cleanup; the
  // request must still either extend that runner or start a replacement.
  const second = queue.request(async () => {
    passes += 1;
  });

  await Promise.all([first, second]);
  expect(passes).toBe(2);
});

test("#371 multiple refresh requests in one pass coalesce to one final read", async () => {
  const queue = new SerializedRefreshQueue();
  const firstPass = deferred();
  let passes = 0;

  const first = queue.request(async () => {
    passes += 1;
    await firstPass.promise;
  });

  await Promise.resolve();
  const second = queue.request(async () => {
    passes += 1;
  });
  const third = queue.request(async () => {
    passes += 1;
  });

  firstPass.resolve();
  await Promise.all([first, second, third]);

  expect(passes).toBe(2);
});
