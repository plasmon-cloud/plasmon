import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const sourceRoot = import.meta.dir;
const appRoot = join(sourceRoot, "..");
const publicRoot = join(appRoot, "public");
const retiredTrees = ["gui" + "2", "plat" + "form"] as const;
const activeSourceGlob = new Glob("**/*.{ts,tsx,js,jsx,mjs,cjs,scss,css}");
const packagedTextGlob = new Glob("**/*.{ts,tsx,js,jsx,mjs,cjs,scss,css,html,json,svg,xml}");
const activeBuildAndPackageFiles = [
  "build.ts",
  "monacoWorkerTransport.ts",
  "package.json",
  "neutron.json",
] as const;

const retiredPathPatterns = retiredTrees.map(
  (segment) => new RegExp("(?:^|[./\\\\])" + segment + "(?:[/\\\\]|[\"'`])"),
);

function containsRetiredPathReference(source: string): boolean {
  return retiredPathPatterns.some((pattern) => pattern.test(source));
}

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
      if (containsRetiredPathReference(source)) violations.push(relativePath);
    }

    expect(violations).toEqual([]);
  });

  test("active build and package surfaces cannot reference retired parallel trees", () => {
    const violations = activeBuildAndPackageFiles.filter((relativePath) =>
      containsRetiredPathReference(readFileSync(join(appRoot, relativePath), "utf8")),
    );

    expect(violations).toEqual([]);
  });

  test("recursively copied public package input cannot revive retired parallel trees", async () => {
    const violations: string[] = [];

    for (const segment of retiredTrees) {
      if (existsSync(join(publicRoot, segment))) violations.push(`${segment}/`);
    }

    for await (const relativePath of packagedTextGlob.scan({ cwd: publicRoot, onlyFiles: true })) {
      const pathSegments = relativePath.split(/[\\/]/);
      const hasRetiredSegment = retiredTrees.some((segment) => pathSegments.includes(segment));
      const source = readFileSync(join(publicRoot, relativePath), "utf8");
      if (hasRetiredSegment || containsRetiredPathReference(source)) violations.push(relativePath);
    }

    expect(violations).toEqual([]);
  });
});
