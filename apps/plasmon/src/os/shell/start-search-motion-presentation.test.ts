// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sharedStyles = readFileSync(new URL("./shell.scss", import.meta.url), "utf8");
const startStyles = readFileSync(new URL("./startSurface.scss", import.meta.url), "utf8");
const searchStyles = readFileSync(new URL("./searchSurface.scss", import.meta.url), "utf8");

test("centered Start and Search do not inherit the transform-writing panel animation", () => {
  expect(sharedStyles).toContain("animation: plasmon-shell-pop");
  expect(sharedStyles).toContain("transform: translateY(8px) scale(.985)");
  expect(sharedStyles).toContain(".plasmon-shell__calendar-panel, .plasmon-shell__tray-panel");

  expect(startStyles).toContain(".plasmon-shell__start-panel");
  expect(startStyles).toContain("animation: none");
  expect(searchStyles).toContain(".plasmon-shell__panel.plasmon-shell__search-panel");
  expect(searchStyles).toContain("animation: none");
});
