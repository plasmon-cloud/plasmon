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
    (path) => !path.startsWith(join(sourceRoot, "platform")),
  );
}

test("— legacy platform consumers and implementation are removed", async () => {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  expect(entries.some((entry) => entry.name === "platform")).toBe(false);

  const references = [] as string[];
  for (const path of await activeSourceFiles()) {
    const text = await readFile(path, "utf8");
    if (/from ["'][^"']*platform(?:\/|["'])|src\/platform/u.test(text)) {
      references.push(relative(root, path));
    }
  }
  expect(references).toEqual([]);

  const build = await readFile(join(root, "build.ts"), "utf8");
  expect(build).not.toContain("src/platform");
  expect(build).not.toContain("DesktopShell");
});
