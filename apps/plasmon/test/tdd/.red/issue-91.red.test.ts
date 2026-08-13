import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { searchShell } from "../../../src/os/shell/search.ts";

test("ordinary category caps are not reported as safety truncation", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const root = await environment.services.fs.resolvePath("/");
    if (!root) throw new Error("filesystem root unavailable");
    for (let index = 0; index < 20; index += 1) await environment.services.fs.createFile(root.id, `cap-${index}.txt`, { mime: "text/plain" });
    const batch = await searchShell(environment.services.fs, [], [], "");
    expect(batch.truncated).toBe(false);
  } finally { environment.dispose(); }
});

test("filesystem traversal safety truncation remains detectable", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const root = await environment.services.fs.resolvePath("/");
    if (!root) throw new Error("filesystem root unavailable");
    await environment.services.fs.createFile(root.id, "first.txt", { mime: "text/plain" });
    await environment.services.fs.createFile(root.id, "second.txt", { mime: "text/plain" });
    const batch = await searchShell(environment.services.fs, [], [], "", { maxNodes: 1 });
    expect(batch.truncated).toBe(true);
  } finally { environment.dispose(); }
});
