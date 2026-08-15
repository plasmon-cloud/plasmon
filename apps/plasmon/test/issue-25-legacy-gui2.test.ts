import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const sourceRoot = join(root, "src");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else files.push(path);
  }
  return files;
}

async function activeSourceFiles(): Promise<string[]> {
  return (await filesUnder(sourceRoot)).filter(
    (path) => !path.startsWith(join(sourceRoot, "gui2")),
  );
}

test("#25 — gui2 is absent from the active source tree after current OS boot is proven", async () => {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  expect(entries.some((entry) => entry.name === "gui2")).toBe(false);

  const references = [] as string[];
  for (const path of await activeSourceFiles()) {
    const text = await readFile(path, "utf8");
    if (/src\/gui2|\.\/gui2|\.\.\/gui2/u.test(text)) {
      references.push(relative(root, path));
    }
  }
  expect(references).toEqual([]);

  const entrypoint = await readFile(join(sourceRoot, "index.tsx"), "utf8");
  expect(entrypoint).toContain("./os/PlasmonOS.tsx");
});
