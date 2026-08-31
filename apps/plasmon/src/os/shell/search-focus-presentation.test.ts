// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sharedStyles = readFileSync(new URL("./searchBoxFocus.scss", import.meta.url), "utf8");
const shellStyles = readFileSync(new URL("./shell.scss", import.meta.url), "utf8");

test("Start and Search replace native input focus chrome with the shared theme focus presentation", () => {
  expect(shellStyles).toContain(".plasmon-shell button:focus-visible, .plasmon-shell input:focus-visible");

  expect(sharedStyles).toContain(".plasmon-shell__start-panel > .plasmon-shell__search-box");
  expect(sharedStyles).toContain(".plasmon-shell__search-panel > .plasmon-shell__search-box");
  expect(sharedStyles).toContain("border-color: var(--plasmon-focus-ring)");
  expect(sharedStyles).toContain("var(--plasmon-focus-ring) 34%");
  expect(sharedStyles).toContain(".plasmon-shell__start-panel > .plasmon-shell__search-box input:focus-visible");
  expect(sharedStyles).toContain(".plasmon-shell__search-panel > .plasmon-shell__search-box input:focus-visible");
  expect(sharedStyles).toContain("outline: none");
  expect(sharedStyles).not.toContain("data-plasmon-theme");
});
