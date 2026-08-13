import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { searchShell, SEARCH_CATEGORY_LIMITS, SEARCH_TOTAL_LIMIT } from "../../../src/os/shell/search.ts";

async function filesystemRoot(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>) {
  const root = await environment.services.fs.resolvePath("/");
  if (!root) throw new Error("filesystem root unavailable");
  return root;
}

test("ordinary category caps preserve bounded results without an incomplete-search signal", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const root = await filesystemRoot(environment);
    for (let index = 0; index < 20; index += 1) {
      await environment.services.fs.createFile(root.id, `cap-${index}.txt`, { mime: "text/plain" });
    }
    const batch = await searchShell(environment.services.fs, [], [], "");
    expect(batch.results.filter((result) => result.category === "documents")).toHaveLength(SEARCH_CATEGORY_LIMITS.documents);
    expect(batch.results.length).toBeLessThanOrEqual(SEARCH_TOTAL_LIMIT);
    expect(batch.truncated).toBe(false);
  } finally { environment.dispose(); }
});

test("combined ordinary presentation caps remain bounded without a safety warning", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const root = await filesystemRoot(environment);
    for (let index = 0; index < 20; index += 1) {
      await environment.services.fs.createFile(root.id, `document-${index}.txt`, { mime: "text/plain" });
      await environment.services.fs.createFile(root.id, `media-${index}.png`, { mime: "image/png" });
      await environment.services.fs.createFile(root.id, `atom-${index}.atom`, { kind: "atom" });
    }
    const batch = await searchShell(environment.services.fs, [], [], "");
    expect(batch.results.length).toBeLessThanOrEqual(SEARCH_TOTAL_LIMIT);
    expect(batch.results.filter((result) => result.category === "documents")).toHaveLength(SEARCH_CATEGORY_LIMITS.documents);
    expect(batch.results.filter((result) => result.category === "media")).toHaveLength(SEARCH_CATEGORY_LIMITS.media);
    expect(batch.results.filter((result) => result.category === "atoms")).toHaveLength(SEARCH_CATEGORY_LIMITS.atoms);
    expect(batch.truncated).toBe(false);
  } finally { environment.dispose(); }
});

test("filesystem traversal safety truncation remains detectable", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const root = await filesystemRoot(environment);
    await environment.services.fs.createFile(root.id, "first.txt", { mime: "text/plain" });
    await environment.services.fs.createFile(root.id, "second.txt", { mime: "text/plain" });
    const batch = await searchShell(environment.services.fs, [], [], "", { maxNodes: 1 });
    expect(batch.truncated).toBe(true);
  } finally { environment.dispose(); }
});
