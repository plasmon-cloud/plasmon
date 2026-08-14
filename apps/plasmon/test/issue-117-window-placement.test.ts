import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

test("committed native window placement survives close and service recomposition", async () => {
  const repositoryEnvironment = createHeadlessPlasmonEnvironment();
  const repository = repositoryEnvironment.repository;
  try {
    const processId = await repositoryEnvironment.services.process.open("native:explorer", {});
    expect(processId).not.toBeNull();
    const before = repositoryEnvironment.windows()[0];
    if (!processId || !before) throw new Error("native Explorer did not create a window");

    repositoryEnvironment.services.windows.move(before.id, 311, 177);
    const committed = repositoryEnvironment.windows()[0];
    expect(committed).toMatchObject({ x: 311, y: 177 });
    expect(repositoryEnvironment.services.process.close(processId)).toBe(true);
    // FsService persistence is asynchronous; wait for the truthful durable boundary
    // before reconstructing production composition over the same repository.
    await repositoryEnvironment.services.windowPlacement.flush();
  } finally {
    repositoryEnvironment.dispose();
  }

  const restarted = createHeadlessPlasmonEnvironment({ repository });
  try {
    const reopened = await restarted.services.process.open("native:explorer", {});
    expect(reopened).not.toBeNull();
    const restored = restarted.windows()[0];
    // Windowing must validate the persisted record; Shell/React must not own it.
    expect(restored).toMatchObject({ x: 311, y: 177 });
  } finally {
    restarted.dispose();
  }
});
