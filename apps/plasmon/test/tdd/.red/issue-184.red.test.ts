import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

test("TaskManager.sys is reconciled as a canonical native system application", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const taskManager = await environment.node("/System/TaskManager.sys");
    expect(taskManager).not.toBeNull();
    expect(taskManager?.kind).toBe("system-app");
    expect(taskManager?.metadata["plasmon.systemApp"]).toMatchObject({
      format: "plasmon.system-app",
    });
  } finally {
    environment.dispose();
  }
});
