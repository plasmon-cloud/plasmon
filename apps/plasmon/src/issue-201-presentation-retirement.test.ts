import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const sourceRoot = import.meta.dir;
const retiredTrees = ["gui" + "2", "plat" + "form"] as const;
const activeSourceGlob = new Glob("**/*.{ts,tsx,js,jsx,mjs,cjs,scss,css}");

const retiredImportMarkers = retiredTrees.flatMap((segment) => [
  `/${segment}/`,
  `./${segment}/`,
  `../${segment}/`,
]);

describe("#201 presentation retirement guards", () => {
  test("retired parallel frontend trees stay removed", () => {
    for (const segment of retiredTrees) {
      expect(existsSync(join(sourceRoot, segment))).toBeFalse();
    }
  });

  test("active frontend source cannot import retired parallel trees", async () => {
    const violations: string[] = [];

    for await (const relativePath of activeSourceGlob.scan({ cwd: sourceRoot, onlyFiles: true })) {
      const source = readFileSync(join(sourceRoot, relativePath), "utf8");
      if (retiredImportMarkers.some((marker) => source.includes(marker))) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
