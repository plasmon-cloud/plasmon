// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./adaptive-surfaces.scss", import.meta.url), "utf8");

test("desktop wallpaper labels use one contrast treatment without changing rename presentation", () => {
  expect(css).toContain(".fm-entry--desktop:not(.is-renaming) .fm-entry__name");
  expect(css).toContain(".fm-entry--desktop .fm-entry__expanded-name");
  expect(css).toContain("var(--plasmon-wallpaper-label-ink)");
  expect(css).toContain("var(--plasmon-wallpaper-label-shadow)");
  expect(css).not.toContain(".fm-entry--desktop.is-renaming .fm-entry__name");
});

test("transparency checker derives from semantic theme colors and is shared by media presentations", () => {
  expect(css).toContain("var(--plasmon-window-background) 92%");
  expect(css).toContain("var(--plasmon-text-primary) 8%");
  expect(css).toContain("var(--plasmon-window-background) 82%");
  expect(css).toContain("var(--plasmon-text-primary) 18%");
  expect(css).toContain(".plasmon-icon-frame--thumbnail");
  expect(css).toContain(".plasmon-native-app-surface[data-photos-display-mode] img");
  expect(css).toContain("background-size: 8px 8px");
  expect(css).not.toContain("data-plasmon-theme");
});
