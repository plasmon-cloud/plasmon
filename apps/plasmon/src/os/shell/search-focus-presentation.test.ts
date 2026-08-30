// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./searchSurface.scss", import.meta.url), "utf8");

test("Search renders focus with the shared theme focus token instead of native input chrome", () => {
  expect(styles).toContain(".plasmon-shell__search-box:focus-within");
  expect(styles).toContain("border-color: var(--plasmon-focus-ring)");
  expect(styles).toContain("var(--plasmon-focus-ring) 34%");
  expect(styles).toContain(".plasmon-shell__search-box input:focus-visible");
  expect(styles).toContain("outline: none");
});
